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

    def __init__(self, app_map_path: Optional[str] = None, claim_regex: str = r"CLM\d{4,8}"):
        self.claim_regex = re.compile(claim_regex, re.IGNORECASE)
        self.app_map = self._load_app_map(app_map_path)
        self.last_window_title: str = ""
        self.last_app_name: str = ""

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

        # 1. Get active window title via pygetwindow if available
        if gw:
            try:
                active_win = gw.getActiveWindow()
                if active_win:
                    window_title = active_win.title or ""
            except Exception:
                pass

        # 1b. Direct Win32 API fallback for ultra-reliable foreground title retrieval
        if not window_title:
            try:
                import ctypes
                u32 = ctypes.windll.user32
                hwnd = u32.GetForegroundWindow()
                if hwnd:
                    length = u32.GetWindowTextLengthW(hwnd)
                    if length > 0:
                        buf = ctypes.create_unicode_buffer(length + 1)
                        u32.GetWindowTextW(hwnd, buf, length + 1)
                        window_title = buf.value or ""
            except Exception:
                pass

        # If the foreground window is our own Claim Work Assistant dialog, preserve the underlying app state
        lower_title = (window_title or "").lower()
        if "claim work assistant" in lower_title:
            return self.last_app_name or "Application", self.last_window_title or "", None

        # 2. Derive App Name from title heuristics or process list
        if self.is_tms_dashboard(app_name, window_title):
            app_name = "TMS Dashboard"
        elif "novaarc-rcm" in lower_title or "krishna-caare" in lower_title or "revenue cycle" in lower_title or ("novaarc" in lower_title and "tms" not in lower_title):
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
        elif window_title:
            app_name = window_title.split("-")[-1].strip() or "Application"

        # 3. Detect Claim ID from window title using Regex
        detected_claim_id = None
        match = self.claim_regex.search(window_title)
        if match:
            detected_claim_id = match.group(0).upper()

        self.last_window_title = window_title
        self.last_app_name = app_name

        return app_name, window_title, detected_claim_id

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

    def is_office_platform(self, app_name: str, window_title: str) -> bool:
        """Returns True if the current foreground window is the company's NovaArc RCM platform (NOT TMS Dashboard)."""
        lt = (window_title or "").lower()
        if "claim work assistant" in lt:
            return False
        if self.is_tms_dashboard(app_name, window_title):
            return False
        return (
            app_name == "NovaArc RCM"
            or "novaarc-rcm" in lt
            or "krishna-caare" in lt
            or "revenue cycle" in lt
            or "caare" in lt
            or ("novaarc" in lt and "tms" not in lt)
        )

    def get_browser_url(self, hwnd: int = 0) -> str:
        """Attempts to read the active address bar URL from Chrome or Edge via UI Automation."""
        if not hwnd:
            try:
                import ctypes
                hwnd = ctypes.windll.user32.GetForegroundWindow()
            except Exception:
                return ""
        try:
            import ctypes
            import comtypes
            from comtypes import client
            ctypes.windll.ole32.CoInitialize(None)
            mod = client.GetModule("UIAutomationCore.dll")
            uia = client.CreateObject(mod.CUIAutomation, interface=mod.IUIAutomation)
            elem = uia.ElementFromHandle(hwnd)
            if not elem:
                return ""

            # Target Chrome / Edge Omnibox directly by AutomationId or Name
            cond_id = uia.CreatePropertyCondition(30011, "address-edit-box")
            edit = elem.FindFirst(4, cond_id)
            if not edit:
                for name in ["Address and search bar", "Search or enter web address", "App & search bar", "Address"]:
                    cond_name = uia.CreatePropertyCondition(30005, name)
                    edit = elem.FindFirst(4, cond_name)
                    if edit:
                        break

            if edit:
                pat = edit.GetCurrentPattern(10002) # ValuePattern
                if pat:
                    val_pat = pat.QueryInterface(mod.IUIAutomationValuePattern)
                    val = (val_pat.CurrentValue or "").strip()
                    if val and ("." in val or "/" in val):
                        return val
        except Exception:
            pass
        return ""

    def is_novaarc_login_page(self, app_name: str, window_title: str, hwnd: int = 0) -> bool:
        """
        Returns True if the employee is currently on the NovaArc login/sign-in screen.
        """
        if not self.is_office_platform(app_name, window_title):
            return False

        lt = (window_title or "").lower()
        if "claim work assistant" in lt:
            return False

        # 1. Address bar URL check
        url = self.get_browser_url(hwnd).lower()
        if url:
            if "/login" in url or "#/login" in url:
                return True
            if any(term in url for term in ["dashboard", "claims", "work-queues", "denials", "payments", "agents", "assistant", "users"]):
                return False

        # 2. Title checks
        if any(term in lt for term in ["welcome back", "sign in", "signin", "login"]):
            return True

        # 3. UI Automation element check for login screen indicators
        if hwnd:
            try:
                import comtypes
                from comtypes import client
                mod = client.GetModule("UIAutomationCore.dll")
                uia = client.CreateObject(mod.CUIAutomation, interface=mod.IUIAutomation)
                elem = uia.ElementFromHandle(hwnd)
                if elem:
                    for signin_term in [
                        "Sign in to access your revenue cycle dashboard",
                        "client_leadership@novaarc.local",
                        "Welcome back",
                        "Sign in",
                        "Sign In"
                    ]:
                        cond = uia.CreatePropertyCondition(30005, signin_term)
                        if elem.FindFirst(4, cond):
                            return True
            except Exception:
                pass

        return False

    def is_novaarc_authenticated(self, app_name: str, window_title: str, hwnd: int = 0) -> bool:
        """
        Returns True if employee has signed in / logged in to NovaArc platform.
        """
        if not self.is_office_platform(app_name, window_title):
            return False

        lt = (window_title or "").lower()
        if "claim work assistant" in lt:
            return False

        # If on login screen, they haven't authenticated yet
        if self.is_novaarc_login_page(app_name, window_title, hwnd):
            return False

        # 1. URL check
        url = self.get_browser_url(hwnd).lower()
        if url:
            if "/login" in url or "#/login" in url:
                return False
            if any(k in url for k in ["dashboard", "claims", "work-queues", "denials", "payments", "agents", "assistant", "users"]):
                return True

        # 2. UI Automation check for dashboard / navigation indicators
        if hwnd:
            try:
                import comtypes
                from comtypes import client
                mod = client.GetModule("UIAutomationCore.dll")
                uia = client.CreateObject(mod.CUIAutomation, interface=mod.IUIAutomation)
                elem = uia.ElementFromHandle(hwnd)
                if elem:
                    for auth_term in [
                        "Dashboard",
                        "Claims",
                        "Work Queues",
                        "Denials",
                        "Payments",
                        "Agents",
                        "Assistant",
                        "Users",
                        "Sign out",
                        "Sign Out",
                        "Revenue Cycle Overview"
                    ]:
                        cond = uia.CreatePropertyCondition(30005, auth_term)
                        if elem.FindFirst(4, cond):
                            return True
            except Exception:
                pass

        return False


