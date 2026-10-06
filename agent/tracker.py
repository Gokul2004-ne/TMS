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

        # 2. Derive App Name from title heuristics or process list
        lower_title = window_title.lower()
        if "excel" in lower_title or ".xlsx" in lower_title or ".csv" in lower_title:
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
