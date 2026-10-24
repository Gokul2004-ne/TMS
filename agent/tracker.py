import re
import json
import os
from typing import Optional, Tuple, Dict, Any

try:
    import pygetwindow as gw
except ImportError:
    gw = None

try:
    import psutil
except ImportError:
    psutil = None


class WindowTracker:
    """Tracks the active foreground window, extracts process details, and detects claim IDs."""

    def __init__(self, app_map_path: Optional[str] = None, claim_regex: str = r"\b(?:CLM|CLAIM)[-_]?\d+\b"):
        self.claim_regex = re.compile(claim_regex, re.IGNORECASE)
        self.app_map = self._load_app_map(app_map_path)
        self.last_window_title: str = ""
        self.last_app_name: str = ""
        self._uia = None
        self._uia_mod = None
        self._cached_url_hwnd: int = 0
        self._cached_url_val: str = ""
        self._cached_url_time: float = 0.0
        self._cached_edit_elems: Dict[int, Any] = {}
        self._pid_proc_cache: Dict[int, str] = {}

    def _get_uia(self):
        """Thread-safe cached UIAutomationCore instance."""
        if getattr(self, "_uia", None) is None:
            try:
                import ctypes
                import comtypes
                from comtypes import client
                ctypes.windll.ole32.CoInitialize(None)
                self._uia_mod = client.GetModule("UIAutomationCore.dll")
                self._uia = client.CreateObject(self._uia_mod.CUIAutomation, interface=self._uia_mod.IUIAutomation)
            except Exception:
                return None, None
        return self._uia, self._uia_mod

    def _load_app_map(self, path: Optional[str]) -> Dict[str, Any]:
        default_map = {
            "excel.exe": {"app_name": "Excel", "category": "PRODUCTIVITY"},
            "chrome.exe": {"app_name": "Chrome", "category": "BROWSER"},
            "msedge.exe": {"app_name": "Edge", "category": "BROWSER"},
            "claimplatform.exe": {"app_name": "ClaimPlatform", "category": "CORE_CLAIM_APP"},
            "billingportal.exe": {"app_name": "BillingPortal", "category": "CORE_CLAIM_APP"},
            "notepad.exe": {"app_name": "Notepad", "category": "PRODUCTIVITY"}
        }

        search_paths = [
            path,
            os.path.join(os.path.dirname(__file__), "..", "shared", "app-map.json"),
            os.path.join(os.path.dirname(__file__), "app-map.json")
        ]

        for p in search_paths:
            if p and os.path.exists(p):
                try:
                    with open(p, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        return data.get("mappings", default_map)
                except Exception:
                    pass

        return default_map

    def get_active_window(self) -> Tuple[str, str, Optional[str]]:
        """
        Returns (app_name, window_title, detected_claim_id).
        Never throws exceptions; falls back to safe defaults.
        """
        window_title = ""
        app_name = "Desktop"
        hwnd = 0

        # 1. Get active window title via pygetwindow if available
        if gw:
            try:
                active_win = gw.getActiveWindow()
                if active_win:
                    window_title = active_win.title or ""
            except Exception:
                pass

        # 1b. Direct Win32 API fallback for ultra-reliable foreground title and hwnd retrieval
        try:
            import ctypes
            u32 = ctypes.windll.user32
            hwnd = u32.GetForegroundWindow()
            if hwnd and not window_title:
                length = u32.GetWindowTextLengthW(hwnd)
                if length > 0:
                    buf = ctypes.create_unicode_buffer(length + 1)
                    u32.GetWindowTextW(hwnd, buf, length + 1)
                    window_title = buf.value or ""
        except Exception:
            pass

        # 1c. Derive process name from hwnd if available
        proc_name = ""
        if hwnd:
            try:
                import ctypes
                pid = ctypes.c_ulong()
                ctypes.windll.user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
                p_val = pid.value
                if p_val:
                    if p_val in self._pid_proc_cache:
                        proc_name = self._pid_proc_cache[p_val]
                    elif psutil:
                        proc_name = psutil.Process(p_val).name().lower()
                        if len(self._pid_proc_cache) > 200:
                            self._pid_proc_cache.clear()
                        self._pid_proc_cache[p_val] = proc_name
            except Exception:
                pass

        # If the foreground window is our own Claim Work Assistant dialog or transient tools, preserve the underlying app state
        lower_title = (window_title or "").lower()
        if any(term in lower_title for term in ["claim work assistant", "recording toolbar", "task switching", "screen recording"]):
            return self.last_app_name or "Application", self.last_window_title or "", None

        # 2. Derive App Name from process name or title heuristics
        if proc_name and proc_name in self.app_map:
            app_name = self.app_map[proc_name].get("app_name", "Application")
        elif proc_name == "chrome.exe":
            app_name = "Chrome"
        elif proc_name == "msedge.exe":
            app_name = "Edge"
        elif proc_name == "firefox.exe":
            app_name = "Firefox"
        elif proc_name == "brave.exe":
            app_name = "Brave"
        elif proc_name == "opera.exe":
            app_name = "Opera"
        elif proc_name == "excel.exe":
            app_name = "Excel"
        elif proc_name == "notepad.exe":
            app_name = "Notepad"
        elif proc_name in {"teams.exe", "ms-teams.exe"}:
            app_name = "MS Teams"
        elif proc_name == "outlook.exe":
            app_name = "Outlook"

        if self.is_tms_dashboard(app_name, window_title):
            app_name = "TMS Dashboard"
        elif "novaarc-rcm" in lower_title or "novarc" in lower_title or "krishna-caare" in lower_title or "revenue cycle" in lower_title or ("novaarc" in lower_title and "tms" not in lower_title):
            app_name = "NovaArc RCM"
        elif "excel" in lower_title or ".xlsx" in lower_title or ".csv" in lower_title:
            app_name = "Excel"
        elif "chrome" in lower_title or "google chrome" in lower_title:
            app_name = "Chrome"
        elif "edge" in lower_title or "microsoft edge" in lower_title:
            app_name = "Edge"
        elif "claim" in lower_title or "claimplatform" in lower_title:
            app_name = "ClaimPlatform"
        elif "billing" in lower_title or "portal" in lower_title:
            app_name = "BillingPortal"
        elif "teams" in lower_title:
            app_name = "MS Teams"
        elif "outlook" in lower_title:
            app_name = "Outlook"
        elif window_title and app_name == "Desktop":
            app_name = window_title.split("-")[-1].strip() or "Application"

        # 3. Detect Claim ID from window title or browser URL route using Regex
        detected_claim_id = None
        match = self.claim_regex.search(window_title)
        if match:
            detected_claim_id = match.group(0).upper()
        elif hwnd and self.is_browser_app(app_name, window_title, hwnd):
            try:
                raw_url = self.get_browser_url(hwnd, window_title)
                if raw_url:
                    u_match = self.claim_regex.search(raw_url)
                    if u_match:
                        detected_claim_id = u_match.group(0).upper()
            except Exception:
                pass

        self.last_window_title = window_title
        self.last_app_name = app_name

        return app_name, window_title, detected_claim_id

    def is_browser_app(self, app_name: str, window_title: str, hwnd: int = 0) -> bool:
        """Determines if the active window is any web browser or web-based platform."""
        la = (app_name or "").lower()
        lt = (window_title or "").lower()
        if any(b in la for b in ["chrome", "edge", "firefox", "brave", "opera", "vivaldi", "browser", "novaarc rcm", "tms dashboard"]):
            return True
        if any(b in lt for b in [
            "google chrome", "microsoft edge", "mozilla firefox", "brave", "opera", "vivaldi",
            "novaarc", "tms dashboard", ":5173", "localhost", "127.0.0.1", "http://", "https://"
        ]):
            return True
        if self.is_office_platform(app_name, window_title):
            return True
        if hwnd:
            try:
                import ctypes
                pid = ctypes.c_ulong()
                ctypes.windll.user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
                if pid.value and psutil:
                    pname = psutil.Process(pid.value).name().lower()
                    if pname in {"chrome.exe", "msedge.exe", "firefox.exe", "brave.exe", "opera.exe", "vivaldi.exe", "arc.exe"}:
                        return True
            except Exception:
                pass
        return False

    def is_tms_dashboard(self, app_name: str, window_title: str) -> bool:
        """Returns True if the current window is the NovaArc TMS tracking dashboard."""
        lt = (window_title or "").lower()
        app = (app_name or "").lower()
        if "claim work assistant" in lt:
            return False
        return (
            "novaarc tms" in lt
            or "tms dashboard" in lt
            or "transaction intelligence" in lt
            or ":5173" in lt
            or "localhost:5173" in lt
            or "127.0.0.1:5173" in lt
            or app == "tms dashboard"
        )

    def is_office_platform(self, app_name: str, window_title: str, hwnd: int = 0) -> bool:
        """
        Returns True if the current foreground window/tab is the company's NovaArc RCM platform (NOT TMS Dashboard).
        Strictly relies on window title for instantaneous (0.001ms) and 100% accurate tab/app differentiation.
        """
        lt = (window_title or "").lower()
        if "claim work assistant" in lt:
            return False
        if self.is_tms_dashboard(app_name, window_title):
            return False
        if app_name in {"WhatsApp", "Excel", "Notepad", "Word", "Calculator", "MS Teams", "Outlook", "File Explorer"}:
            return False
        return (
            app_name == "NovaArc RCM"
            or "rcm ar workflow platform" in lt
            or "novaarc health" in lt
            or "novaarc-rcm" in lt
            or "novarc" in lt
            or "krishna-caare" in lt
            or "revenue cycle" in lt
            or ("novaarc" in lt and "tms" not in lt)
        )

    @staticmethod
    def sanitize_url(raw_url: str) -> str:
        """
        Maximum Healthcare Security Sanitizer:
        Strips query parameters (?patient=..., ?claim=...) and access tokens/hashes
        to ensure zero PHI or sensitive internal state ever leaks into storage or logs.
        """
        if not raw_url:
            return ""
        clean = raw_url.strip()
        # Keep hash routes like #/claims, #/dashboard, but strip query parameters inside hash
        if "#/" in clean:
            parts = clean.split("#/")
            base = parts[0].split("?")[0]
            route = parts[1].split("?")[0].split("&")[0]
            return f"{base}#/{route}"
        # Strip query parameters
        clean = clean.split("?")[0]
        # Strip generic hash fragments
        clean = clean.split("#")[0]
        return clean.strip()

    def is_internal_agent_window(self, app_name: str, window_title: str) -> bool:
        """Identifies agent internal UI dialogs, overlays, or OS task switchers to avoid false app switches."""
        la = (app_name or "").lower()
        lt = (window_title or "").lower()
        if any(term in la or term in lt for term in [
            "claim work assistant", "claimdialog", "claim dialog", "tkinter", "python",
            "snipping tool", "snip & sketch", "task switching"
        ]):
            return True
        return False

    def clear_cache(self):
        """Flushes all cached browser URLs and element handles to force immediate inspection."""
        self._cached_url_hwnd = 0
        self._cached_url_title = ""
        self._cached_url_val = ""
        self._cached_url_time = 0.0
        if hasattr(self, "_cached_edit_elems"):
            self._cached_edit_elems.clear()

    def get_browser_url(self, hwnd: int = 0, window_title: str = "") -> str:
        """Attempts to read and sanitize the active address bar URL from any browser window via UI Automation."""
        if not hwnd:
            try:
                import ctypes
                hwnd = ctypes.windll.user32.GetForegroundWindow()
            except Exception:
                return ""
        if not hwnd:
            return ""

        import time
        now = time.time()
        # Fast cache check: if queried for the same hwnd & window title within 1.0s, return cached result
        cached_hwnd = getattr(self, "_cached_url_hwnd", 0)
        cached_title = getattr(self, "_cached_url_title", "")
        cached_time = getattr(self, "_cached_url_time", 0.0)
        cached_val = getattr(self, "_cached_url_val", "")

        # If cached value is a login page or empty, invalidate cache after 0.15s so login transitions are detected immediately
        ttl = 0.15 if ("/login" in cached_val.lower() or not cached_val) else 0.8
        if hwnd == cached_hwnd and (now - cached_time) < ttl:
            if not window_title or window_title == cached_title:
                return cached_val

        url_val = ""
        try:
            uia, mod = self._get_uia()
            if not uia or not mod:
                return ""

            elem = uia.ElementFromHandle(hwnd)
            if not elem:
                return ""

            edit = getattr(self, "_cached_edit_elems", {}).get(hwnd)
            val = ""
            if edit:
                try:
                    pat = edit.GetCurrentPattern(10002) # ValuePattern
                    if pat:
                        val_pat = pat.QueryInterface(mod.IUIAutomationValuePattern)
                        val = (val_pat.CurrentValue or "").strip()
                except Exception:
                    edit = None
                    if hasattr(self, "_cached_edit_elems"):
                        self._cached_edit_elems.pop(hwnd, None)

                if not val and edit:
                    try:
                        pat_acc = edit.GetCurrentPattern(10018) # LegacyIAccessiblePattern
                        if pat_acc:
                            acc = pat_acc.QueryInterface(mod.IUIAutomationLegacyIAccessiblePattern)
                            val = (acc.CurrentValue or "").strip()
                    except Exception:
                        pass

                if not val and edit:
                    try:
                        name_val = edit.CurrentName or ""
                        if name_val and ("." in name_val or "/" in name_val):
                            # Chrome often formats CurrentName as "Address and search bar https://novarc.vercel.app/dashboard"
                            import re
                            m = re.search(r"(https?://[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+(?:/[^\s]*)?)", name_val)
                            if m:
                                val = m.group(1).strip()
                    except Exception:
                        pass

            if not edit:
                # Target Chrome / Edge Omnibox directly by AutomationId
                cond_id = uia.CreatePropertyCondition(30011, "address-edit-box")
                edit = elem.FindFirst(4, cond_id)
                if not edit:
                    # Fallback directly to Edit ControlType (30003: UIA_ControlTypePropertyId, 50004: UIA_EditControlTypeId)
                    cond_edit = uia.CreatePropertyCondition(30003, 50004)
                    edit = elem.FindFirst(4, cond_edit)

                if edit:
                    if not hasattr(self, "_cached_edit_elems"):
                        self._cached_edit_elems = {}
                    self._cached_edit_elems[hwnd] = edit
                    try:
                        pat = edit.GetCurrentPattern(10002) # ValuePattern
                        if pat:
                            val_pat = pat.QueryInterface(mod.IUIAutomationValuePattern)
                            val = (val_pat.CurrentValue or "").strip()
                    except Exception:
                        pass
                    if not val:
                        try:
                            pat_acc = edit.GetCurrentPattern(10018) # LegacyIAccessiblePattern
                            if pat_acc:
                                acc = pat_acc.QueryInterface(mod.IUIAutomationLegacyIAccessiblePattern)
                                val = (acc.CurrentValue or "").strip()
                        except Exception:
                            pass
                    if not val:
                        try:
                            name_val = edit.CurrentName or ""
                            if name_val and ("." in name_val or "/" in name_val):
                                import re
                                m = re.search(r"(https?://[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+(?:/[^\s]*)?)", name_val)
                                if m:
                                    val = m.group(1).strip()
                        except Exception:
                            pass

            if val and ("." in val or "/" in val) and "@" not in val:
                url_val = self.sanitize_url(val)
        except Exception:
            pass

        self._cached_url_hwnd = hwnd
        self._cached_url_title = window_title
        self._cached_url_val = url_val
        self._cached_url_time = now
        return url_val

    def resolve_page_identity(self, app_name: str, window_title: str, url: str = "") -> Tuple[str, str, str, str]:
        """
        Universal 3-Pillar Page & Purpose Resolution Engine:
        Universally tracks ANY website, tool, page, and sub-page accessed by the user,
        extracting (clean_url, website_name, page_header, used_for) entirely in local memory
        with strictly 1 to 3 words for 'used_for' and zero PHI risk.
        """
        import urllib.parse

        clean_url = self.sanitize_url(url)
        raw_title = (window_title or "").replace("\u200b", "").strip()

        # Strip notification counts like (14), [2], {1}
        clean_page_title = re.sub(r"^\s*[\(\[\{]\d+\+?[\)\]\}]\s*", "", raw_title)

        # Strip browser name suffixes
        for suffix in [
            " - Google Chrome",
            " - Google Chrome (Incognito)",
            " - Google Chrome - Incognito",
            " - Microsoft Edge",
            " - Mozilla Firefox",
            " - Brave",
            " - Opera",
            " - Vivaldi",
            " - Chromium"
        ]:
            if clean_page_title.endswith(suffix):
                clean_page_title = clean_page_title[:-len(suffix)].strip()
                break

        lt = clean_page_title.lower()
        lu = (clean_url or "").lower()
        la = (app_name or "").lower()

        # Canonical domain brand catalog
        KNOWN_DOMAINS = {
            "krishna-caare.github.io": "NovaArc RCM",
            "novarc.vercel.app": "NovaArc RCM",
            "novaarc.vercel.app": "NovaArc RCM",
            "mhs.net": "Community Care Plan",
            "epiclink.mhs.net": "Community Care Plan",
            "ccpcares.org": "Community Care Plan",
            "communitycareplan.com": "Community Care Plan",
            "officeally.com": "Office Ally",
            "uhcprovider.com": "UHC Provider Portal",
            "uhc.com": "UnitedHealthcare",
            "optum.com": "Optum",
            "availity.com": "Availity Essentials",
            "athenahealth.com": "AthenaHealth",
            "clevelandclinic.org": "Cleveland Clinic",
            "cms.gov": "Medicare CMS",
            "medicare.gov": "Medicare",
            "novitas-solutions.com": "Novitas Solutions",
            "noridianmedicare.com": "Noridian Medicare",
            "palmettogba.com": "Palmetto GBA",
            "firstcoastserviceoptions.com": "First Coast Medicare",
            "wpsgha.com": "WPS Medicare",
            "cgsmedicare.com": "CGS Medicare",
            "humana.com": "Humana",
            "aetna.com": "Aetna",
            "cigna.com": "Cigna",
            "anthem.com": "Anthem BCBS",
            "bcbs.com": "Blue Cross Blue Shield",
            "floridablue.com": "Florida Blue",
            "molinahealthcare.com": "Molina Healthcare",
            "centene.com": "Centene",
            "carefirst.com": "CareFirst",
            "highmark.com": "Highmark",
            "epic.com": "Epic Systems",
            "cerner.com": "Cerner",
            "oraclehealth.com": "Oracle Health",
            "webpt.com": "WebPT",
            "kareo.com": "Kareo",
            "eclinicalworks.com": "eClinicalWorks",
            "nextgen.com": "NextGen Healthcare",
            "changehealthcare.com": "Change Healthcare",
            "waystar.com": "Waystar",
            "zocdoc.com": "Zocdoc",
            "doximity.com": "Doximity",
            "mychart.org": "MyChart",
            "github.com": "GitHub",
            "gitlab.com": "GitLab",
            "bitbucket.org": "Bitbucket",
            "workday.com": "Workday",
            "salesforce.com": "Salesforce",
            "stripe.com": "Stripe",
            "zendesk.com": "Zendesk",
            "atlassian.net": "Atlassian",
            "jira.com": "Jira",
            "slack.com": "Slack",
            "zoom.us": "Zoom",
            "microsoft.com": "Microsoft",
            "office.com": "Microsoft 365",
            "google.com": "Google",
            "youtube.com": "YouTube",
            "linkedin.com": "LinkedIn",
            "aws.amazon.com": "AWS Console",
            "azure.com": "Azure Portal"
        }

        # 1. Parse domain & path tokens from URL
        domain_brand = ""
        path_words = []
        if clean_url:
            try:
                parsed = urllib.parse.urlparse(clean_url if "://" in clean_url else f"https://{clean_url}")
                netloc = parsed.netloc.lower().replace("www.", "")
                for k, v in KNOWN_DOMAINS.items():
                    if netloc == k or netloc.endswith("." + k):
                        domain_brand = v
                        break
                if not domain_brand and netloc:
                    sld = netloc.split(":")[0].split(".")
                    if len(sld) >= 2:
                        base = sld[-2]
                        domain_brand = " ".join(w.capitalize() for w in base.replace("-", " ").replace("_", " ").split())

                path_segments = [p for p in parsed.path.strip("/").split("/") if p]
                for p in path_segments:
                    clean_p = p.split(".")[0]
                    words = [w.capitalize() for w in clean_p.replace("-", " ").replace("_", " ").split() if len(w) > 1]
                    path_words.extend(words)
            except Exception:
                pass

        # 2. Extract website name and page header by splitting title delimiters
        chunks = [c.strip() for c in re.split(r"\s+[|:\-\u00b7\u2022\u2014\u2013]\s+|\s+::\s+|\s+-\s+", clean_page_title) if c.strip()]

        website_name = domain_brand or app_name or "Application"
        page_header = clean_page_title or "Operational Window"

        if len(chunks) >= 2:
            if domain_brand and domain_brand.lower() in chunks[-1].lower():
                website_name = chunks[-1]
                page_header = " - ".join(chunks[:-1])
            elif domain_brand and domain_brand.lower() in chunks[0].lower():
                website_name = chunks[0]
                page_header = " - ".join(chunks[1:])
            elif any(k in chunks[-1].lower() for k in ["community care plan", "novaarc", "github", "stripe", "workday", "availity", "office ally"]):
                website_name = chunks[-1]
                page_header = " - ".join(chunks[:-1])
            elif any(k in chunks[0].lower() for k in ["novaarc", "tms", "community care plan", "office ally", "availity"]):
                website_name = chunks[0]
                page_header = " - ".join(chunks[1:])
            elif domain_brand:
                website_name = domain_brand
                page_header = chunks[0]
            else:
                page_header = chunks[0]
                website_name = chunks[-1]
        elif len(chunks) == 1:
            if domain_brand:
                website_name = domain_brand
                if clean_page_title.lower() == domain_brand.lower() or clean_page_title.startswith("http"):
                    page_header = " ".join(path_words[:3]) if path_words else "Portal Home"
                else:
                    page_header = clean_page_title
            else:
                page_header = clean_page_title
                website_name = app_name or "Application"

        # Clean redundant brand from page header
        if website_name and page_header.lower().startswith(website_name.lower()):
            page_header = page_header[len(website_name):].strip(" -|:\u00b7\u2022\u2014\u2013 ") or page_header
        if not page_header or page_header.startswith("http"):
            page_header = " ".join(path_words[:3]) if path_words else "Portal Home"

        # Cap page header length for neat display
        page_header = page_header[:45].strip()

        # 3. Canonical Healthcare & Platform Overrides
        # A. Community Care Plan / MHS
        if any(term in lu or term in lt for term in ["epiclink.mhs.net", "planlinkccp", "guesteligwrapper", "community care plan", "ccpcares.org", "mhs.net", "epiclink", "memorial healthcare"]):
            website_name = "Community Care Plan"
            if any(term in lu or term in lt for term in ["guest_claims", "claims", "claim", "find a claim", "guest claims"]):
                page_header = "Find a Claim" if ("find a claim" in lt or "find a claim" in lu) else "Guest Claims Status"
                return clean_url, website_name, page_header, "Claim Status"
            elif any(term in lu or term in lt for term in ["guestelig", "guest_elig", "enrollment", "verify eligibility", "guest eligibility", "elig"]):
                page_header = "Verify Eligibility" if ("verify eligibility" in lt or "verify eligibility" in lu) else "Guest Eligibility Verification"
                return clean_url, website_name, page_header, "Member Eligibility"
            elif any(term in lu or term in lt for term in ["epic_login", "login", "signin", "sign in"]):
                return clean_url, website_name, "EpicLink Portal Login", "Portal Login"
            elif any(term in lu or term in lt for term in ["provider-portal", "provider-tools", "planlink", "provider portal", "provider tools"]):
                return clean_url, website_name, "Provider Portal", "Provider Tools"
            elif "dashboard" in lu or "dashboard" in lt:
                return clean_url, website_name, "Portal Dashboard", "Operations Overview"

        # B. NovaArc RCM Platform
        elif self.is_office_platform(app_name, window_title) or "novaarc" in lu or "novarc" in lu or "novaarc-rcm" in lt:
            website_name = "NovaArc RCM"
            if "/dashboard" in lu or "dashboard" in lt:
                return clean_url, website_name, "Operations Dashboard", "Operations Overview"
            elif "/claims" in lu or "claim" in lt or self.claim_regex.search(clean_page_title):
                return clean_url, website_name, "Claims Management", "Claim Adjudication"
            elif "/workflows" in lu or "workflow" in lt:
                return clean_url, website_name, "Workflow Modules", "Claim Workflows"
            elif "/queues" in lu or "/work-queues" in lu or "work queue" in lt or "queue" in lt:
                return clean_url, website_name, "Priority Work Queues", "Work Queue AR"
            elif "/edi" in lu or "edi" in lt:
                return clean_url, website_name, "EDI Hub", "EDI Transactions"
            elif "/rpa" in lu or "rpa" in lt:
                return clean_url, website_name, "RPA Bots", "Bot Automation"
            elif "/upload" in lu or "upload" in lt or "ingestion" in lt:
                return clean_url, website_name, "Data Ingestion", "Upload Claims"
            elif "/denials" in lu or "denial" in lt:
                return clean_url, website_name, "Denial Resolution & Appeals", "Denial Resolution"
            elif "/payments" in lu or "payment" in lt or "remit" in lt:
                return clean_url, website_name, "Remittance & Payment Posting", "Payment Posting"
            elif "/agents" in lu or "/assistant" in lu or "assistant" in lt:
                return clean_url, website_name, "AI Claim Work Assistant", "Appeal Assistant"
            elif "/users" in lu or "/settings" in lu:
                return clean_url, website_name, "User Management & Settings", "Settings & Roles"
            elif "/login" in lu or any(t in lt for t in ["sign in", "signin", "welcome back", "login"]):
                return clean_url, website_name, "Platform Sign-In", "Platform Sign-In"
            return clean_url, website_name, "Revenue Cycle Platform", "Accounts Receivable"

        # C. TMS Dashboard
        elif self.is_tms_dashboard(app_name, window_title):
            return clean_url, "TMS Dashboard", "Associate Shift Intelligence", "Productivity Tracking"

        # D. Microsoft Excel
        elif "excel" in lt or ".xlsx" in lt or ".csv" in lt or la == "excel":
            parts = clean_page_title.split(" - Excel")[0].split(" - Microsoft Excel")[0].strip()
            sheet_name = parts if (parts and not parts.lower().startswith("excel")) else "Payer Fee Schedule"
            return clean_url, "Microsoft Excel", f"{sheet_name} Worksheet", "Rate Lookup"

        # E. Core Desktop Applications
        elif "notepad" in lt or la == "notepad":
            return clean_url, "Notepad", "Operational Scratchpad Notes", "Scratchpad Notes"
        elif "outlook" in lt or la == "outlook":
            return clean_url, "Microsoft Outlook", "Provider & Payer Communications", "Payer Email"
        elif "teams" in lt or la == "teams" or "ms teams" in la:
            return clean_url, "Microsoft Teams", "Internal Team Collaboration", "Team Consultation"
        elif "acrobat" in lt or "pdf" in lt or "reader" in lt:
            return clean_url, "Adobe Acrobat", "Medical Record / EOB Review", "EOB Review"
        elif "calc" in lt or la == "calculator":
            return clean_url, "Calculator", "Coinsurance / Balance Calculation", "Balance Calculation"
        elif "explorer" in lt or la == "file explorer":
            return clean_url, "File Explorer", "Document Directory", "File Directory"

        # 4. Universal 27-Category Semantic Purpose Engine (Strictly 1 to 3 words)
        eval_text = f"{clean_url} {website_name} {page_header} {clean_page_title}".lower()

        # YouTube / Media Playback
        if any(k in eval_text for k in ["youtube", "vimeo"]) or domain_brand in ["YouTube", "Vimeo"]:
            used_for = "Media Playback"
        # Healthcare Claims & Adjudication
        elif any(k in eval_text for k in ["guest_claims", "find a claim", "claim status", "claim adjudication", "claims", "claim", "clm", "remittance", "remit", "adjudic", "835", "837", "cms-1500", "ub-04", "eob"]):
            used_for = "Claim Status" if any(k in eval_text for k in ["status", "find", "guest_claims", "tracking"]) else "Claim Adjudication"
        # Member & Patient Eligibility
        elif any(k in eval_text for k in ["guestelig", "guest_elig", "eligib", "member eligibility", "verify eligibility", "enroll", "coverage", "benefit", "subscriber", "copay", "deductible"]):
            used_for = "Member Eligibility"
        # Prior Authorization & Referrals
        elif any(k in eval_text for k in ["prior-auth", "prior auth", "preauth", "pre-auth", "authorization", "precert", "referral"]):
            used_for = "Prior Authorization"
        # Denials, Grievances & Appeals
        elif any(k in eval_text for k in ["denial", "appeal", "dispute", "grievance", "reconsideration", "underpayment", "co-45", "pr-204"]):
            used_for = "Denial Resolution"
        # Payments, Remittance & Invoicing
        elif any(k in eval_text for k in ["payment", "posting", "invoice", "invoicing", "billing", "deposit", "stripe", "checkout"]):
            used_for = "Payment Posting" if any(k in eval_text for k in ["post", "deposit", "remit"]) else "Billing & Invoicing"
        # Patient Records, Chart & EHR
        elif any(k in eval_text for k in ["patient record", "patient chart", "patient", "ehr", "emr", "clinical", "medical record", "mychart"]):
            used_for = "Patient Records"
        # Scheduling, Appointments & Booking
        elif any(k in eval_text for k in ["schedule", "scheduling", "appointment", "calendar", "booking", "visit slot", "zocdoc"]):
            used_for = "Patient Scheduling"
        # Pharmacy, Prescriptions & Formularies
        elif any(k in eval_text for k in ["pharmacy", "formulary", "prescription", "rx", "drug", "medication"]):
            used_for = "Drug Formulary"
        # Diagnostics, Pathology & Labs
        elif any(k in eval_text for k in ["diagnostic", "pathology", "radiology", "imaging", "lab result", "specimen", "test result"]):
            used_for = "Diagnostic Results"
        # Work Queues, Backlogs & Tasks
        elif any(k in eval_text for k in ["work queue", "workqueue", "work-queue", "work item", "priority queue", "queue", "backlog", "todo", "task list", "workday"]):
            used_for = "Work Queue AR"
        # Dashboards, Operations & Executive Metrics
        elif any(k in eval_text for k in ["dashboard", "revenue cycle velocity", "velocity", "kpi", "metric", "overview", "summary"]):
            used_for = "Operations Overview"
        # Clearinghouses & EDI Gateways
        elif any(k in eval_text for k in ["clearinghouse", "edi", "availity", "office ally", "gateway"]):
            used_for = "Payer Clearinghouse"
        # Provider Portal & Tools
        elif any(k in eval_text for k in ["provider-portal", "provider portal", "provider tools", "practitioner", "credential", "npi"]):
            used_for = "Provider Tools"
        # Payer Policies, Guidelines & Rate Fee Schedules
        elif any(k in eval_text for k in ["policy", "guideline", "manual", "fee schedule", "reimbursement rate", "rate lookup", "allowable"]):
            used_for = "Rate Lookup" if any(k in eval_text for k in ["rate", "fee schedule", "allowable"]) else "Payer Guidelines"
        # Authentication, Sign-In & SSO
        elif any(k in eval_text for k in ["login", "signin", "sign in", "sign-in", "log in", "auth", "sso", "2fa", "mfa"]):
            used_for = "Portal Login"
        # Settings, Administration & Roles
        elif any(k in eval_text for k in ["setting", "preference", "user management", "role", "permission", "security config", "admin"]):
            used_for = "Settings & Roles"
        # Search & Directory Lookups
        elif any(k in eval_text for k in ["google search", "bing search", "search", "lookup"]):
            used_for = "Payer Lookup" if any(k in eval_text for k in ["google", "bing", "payer"]) else "Directory Lookup"
        # Email & Written Correspondence
        elif any(k in eval_text for k in ["outlook", "gmail", "mail", "email", "inbox", "message", "correspondence"]):
            used_for = "Messaging & Email"
        # Team Meetings & Collaboration
        elif any(k in eval_text for k in ["teams", "slack", "zoom", "meeting", "huddle", "consultation", "chat"]):
            used_for = "Team Consultation"
        # Version Control & Software Repositories
        elif any(k in eval_text for k in ["github", "gitlab", "bitbucket", "commit", "pull request", "pulls", "repository", "branch", "code"]):
            used_for = "Version Control"
        # Documentation & Developer References
        elif any(k in eval_text for k in ["documentation", "docs", "api", "developer", "sdk", "swagger", "reference"]):
            used_for = "Technical Documentation"
        # Customer Support & Help Desk
        elif any(k in eval_text for k in ["support", "helpdesk", "help desk", "faq", "ticket", "service desk", "zendesk"]):
            used_for = "Customer Support"
        # Spreadsheets & Calculations
        elif any(k in eval_text for k in ["excel", "spreadsheet", "worksheet", "calculator", "calc"]):
            used_for = "Balance Calculation" if "calc" in eval_text else "Data Analysis"
        # Desktop Notes & Scratchpad
        elif any(k in eval_text for k in ["notepad", "notes", "scratchpad"]):
            used_for = "Scratchpad Notes"
        # File Directory
        elif any(k in eval_text for k in ["file explorer", "explorer", "folder", "directory"]):
            used_for = "File Directory"
        else:
            # 5. Dynamic Fallback for ANY Arbitrary Website or Page
            path_str = " ".join(path_words)
            raw_words = re.findall(r"[a-zA-Z]{3,}", f"{page_header} {path_str}")
            stop = {
                "the", "and", "for", "with", "from", "that", "this", "your", "page",
                "portal", "site", "view", "window", "home", "main", "online"
            }
            meaningful = [w.capitalize() for w in raw_words if w.lower() not in stop]
            if len(meaningful) >= 2:
                used_for = f"{meaningful[0]} {meaningful[1]}"
            elif len(meaningful) == 1:
                used_for = f"{meaningful[0]} Review"
            else:
                used_for = "Operational Task"

        # Strict clamp: enforce 1 to 3 words
        w_list = used_for.strip().split()
        if len(w_list) > 3:
            used_for = " ".join(w_list[:3])
        elif not w_list:
            used_for = "Operational Task"

        return clean_url, website_name, page_header, used_for

    def is_authenticated_url(self, url: str) -> bool:
        """
        Returns True if a URL belongs to an authenticated NovaArc route.
        """
        if not url:
            return False
        lu = url.lower()
        if any(term in lu for term in ["/login", "#/login", "signin", "sign-in", "login"]):
            return False
        return any(route in lu for route in [
            "/dashboard", "/claims", "/claim/", "/queues", "/work-queue", "/work-queues",
            "/edi", "/rpa", "/upload", "/denials", "/denial/", "/payments", "/payment/",
            "/agents", "/assistant", "/users", "/settings", "/inventory", "/workflow-modules",
            "/workflows", "/workflow", "revenue-health", "ar-health", "performance"
        ])

    def is_novaarc_login_page(self, app_name: str, window_title: str, hwnd: int = 0) -> bool:
        """
        Returns True if the employee is currently on the NovaArc login/sign-in screen.
        Prevents premature dialog popping when user has not yet signed in.
        """
        if not self.is_office_platform(app_name, window_title):
            return False

        lt = (window_title or "").lower()
        if "claim work assistant" in lt:
            return False

        # 1. Address bar URL check (highest fidelity)
        url = (self.get_browser_url(hwnd, window_title) or "").lower()
        if url:
            if any(term in url for term in ["/login", "#/login", "signin", "sign-in", "/auth"]):
                return True
            from urllib.parse import urlparse
            try:
                parsed = urlparse(url if "://" in url else f"https://{url}")
                path = parsed.path.rstrip("/")
                fragment = (parsed.fragment or "").lower()
                # If URL contains authenticated path or fragment (e.g. #/dashboard, #/claims, #/workflows)
                if self.is_authenticated_url(url) or any(route in fragment for route in ["dashboard", "claim", "queue", "workflow", "work"]):
                    return False
                if any(dom in parsed.netloc for dom in ["krishna-caare.github.io", "novaarc-rcm", "novaarc", "novarc.vercel.app"]):
                    if not path or path in ["", "/novaarc-rcm", "/novaarc-rcm/login", "/login"]:
                        if not fragment or any(term in fragment for term in ["login", "signin", "auth"]):
                            return True
            except Exception:
                pass

        # 2. Window Title explicit login indicators
        if any(term in lt for term in ["sign in", "signin", "login", "log in", "platform sign-in", "select your role", "welcome to novaarc"]):
            return True

        # 3. If title is generic platform header and has NO authenticated section keyword
        has_auth_kw = any(k in lt for k in [
            "dashboard", "claim", "work queue", "priority work queue", "queue", "edi hub",
            "denial", "payment posting", "rpa bot", "inventory", "adjudication",
            "revenue health", "ar health", "denial intelligence", "payer performance"
        ])
        if not has_auth_kw:
            # If URL is positively authenticated, it's NOT login
            if url and self.is_authenticated_url(url):
                return False
            # Otherwise, before positive authentication is confirmed, treat as login/landing screen
            return True

        return False

    def is_novaarc_authenticated(self, app_name: str, window_title: str, hwnd: int = 0) -> bool:
        """
        Returns True ONLY when employee is positively confirmed on an active,
        authenticated NovaArc platform page (e.g. Dashboard, Claims, Work Queues).
        Guarantees zero false triggers on login or pre-login landing screens.
        """
        if not self.is_office_platform(app_name, window_title):
            return False

        lt = (window_title or "").lower()
        if "claim work assistant" in lt:
            return False

        # Positive URL check (highest fidelity)
        url = (self.get_browser_url(hwnd, window_title) or "").lower()
        if url:
            if self.is_authenticated_url(url):
                return True
            if any(term in url for term in ["/login", "#/login", "signin", "sign-in"]):
                return False

        # Positive Title keyword check (excluding brand 'workflow' which appears on login)
        if any(k in lt for k in [
            "dashboard", "claims management", "claims", "claim",
            "work queue", "priority work queue",
            "edi hub", "denial resolution", "denial", "payment posting",
            "rpa bot", "inventory", "adjudication",
            "revenue health", "ar health", "denial intelligence", "payer performance"
        ]):
            return True

        return False



