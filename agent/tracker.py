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

        # 2. Derive App Name from title heuristics or process list
        lower_title = window_title.lower()
        if "novaarc" in lower_title or "novaarc-rcm" in lower_title or "krishna-caare" in lower_title or "revenue cycle" in lower_title:
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

    def is_office_platform(self, app_name: str, window_title: str) -> bool:
        """Returns True if the current foreground window is the company's NovaArc RCM platform."""
        lt = (window_title or "").lower()
        return (
            app_name == "NovaArc RCM"
            or "novaarc" in lt
            or "novaarc-rcm" in lt
            or "krishna-caare" in lt
            or "revenue cycle" in lt
            or "caare" in lt
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
            # UIA_ControlTypePropertyId = 30003, Edit = 50004
            cond = uia.CreatePropertyCondition(30003, 50004)
            edit = elem.FindFirst(4, cond) # TreeScope_Descendants = 4
            if edit:
                pat = edit.GetCurrentPattern(10002) # ValuePattern = 10002
                if pat:
                    val_pat = pat.QueryInterface(mod.IUIAutomationValuePattern)
                    return (val_pat.CurrentValue or "").strip()
        except Exception:
            pass
        return ""

    def is_novaarc_login_page(self, app_name: str, window_title: str, hwnd: int = 0) -> bool:
        """
        Returns True if the employee is currently on the NovaArc login/sign-in screen.
        Matches URL (/login) or window title indicators ('Welcome back', 'Sign in', 'Login').
        """
        if not self.is_office_platform(app_name, window_title):
            return False

        lt = (window_title or "").lower()
        # Direct title check
        if any(term in lt for term in ["welcome back", "sign in", "signin", "login", "auth"]):
            return True

        # URL check in browser address bar
        url = self.get_browser_url(hwnd).lower()
        if url:
            if "/login" in url or "#/login" in url or "login" in url or "signin" in url:
                return True
            if "dashboard" in url or "claims" in url or "work-queues" in url or "denials" in url:
                return False

        # UI Automation fallback: inspect elements in active window
        if hwnd:
            try:
                import comtypes
                from comtypes import client
                mod = client.GetModule("UIAutomationCore.dll")
                uia = client.CreateObject(mod.CUIAutomation, interface=mod.IUIAutomation)
                elem = uia.ElementFromHandle(hwnd)
                if elem:
                    # If "Welcome back" or "Sign in" or login email appears in page
                    for term in ["Welcome back", "Sign in", "client_leadership@novaarc.local"]:
                        cond = uia.CreatePropertyCondition(30005, term)
                        if elem.FindFirst(4, cond):
                            return True
            except Exception:
                pass

        # If on NovaArc platform and title still has "Revenue Cycle Management" or URL isn't yet loaded,
        # treat as login page if URL contains login or if no dashboard/claims indicators
        if url:
            if not any(k in url for k in ["dashboard", "claims", "work-queues", "denials"]):
                # If path is /login or empty/root, it's the login route
                if "/login" in url or url.rstrip("/").endswith("novaarc-rcm"):
                    return True

        return False

    def is_novaarc_authenticated(self, app_name: str, window_title: str, hwnd: int = 0) -> bool:
        """
        Returns True if the employee is on the NovaArc platform AND has successfully signed in/logged in.
        """
        if not self.is_office_platform(app_name, window_title):
            return False

        # If on login screen, they haven't authenticated yet
        if self.is_novaarc_login_page(app_name, window_title, hwnd):
            return False

        url = self.get_browser_url(hwnd).lower()
        if url:
            if "/login" in url or "#/login" in url:
                return False
            if any(k in url for k in ["dashboard", "claims", "work-queues", "denials", "payments", "agents", "assistant"]):
                return True

        return True

