import os
import re
import sqlite3
import threading
import tkinter as tk
from tkinter import messagebox
from typing import Optional, Callable, List, Tuple, Any
import requests

try:
    import ctypes
    ctypes.windll.shcore.SetProcessDpiAwareness(1)
except Exception:
    try:
        import ctypes
        ctypes.windll.user32.SetProcessDPIAware()
    except Exception:
        pass


STANDARD_CLAIM_TYPES = [
    {
        "id": "CR_CALL",
        "short_name": "CR - Call / IVR",
        "label": "CR - Call / IVR (14 mins)",
        "target_minutes": 14,
        "target_seconds": 840,
    },
    {
        "id": "CR_PORTAL",
        "short_name": "CR - Review / Portal",
        "label": "CR - Review / Portal (4 mins)",
        "target_minutes": 4,
        "target_seconds": 240,
    },
    {
        "id": "AP_WRITTEN",
        "short_name": "AP - Review / Written",
        "label": "AP - Review / Written (18 mins)",
        "target_minutes": 18,
        "target_seconds": 1080,
    },
    {
        "id": "AP_CALL",
        "short_name": "AP - Call / Conference",
        "label": "AP - Call / Conference (30 mins)",
        "target_minutes": 30,
        "target_seconds": 1800,
    },
    {
        "id": "SI_CALL",
        "short_name": "SI - Call / IVR",
        "label": "SI - Call / IVR (7 mins)",
        "target_minutes": 7,
        "target_seconds": 420,
    },
    {
        "id": "SI_PORTAL",
        "short_name": "SI - Review / Portal",
        "label": "SI - Review / Portal (2 mins)",
        "target_minutes": 2,
        "target_seconds": 120,
    },
    {
        "id": "DM_CLINICAL",
        "short_name": "DM - Clinical / Auth",
        "label": "DM - Clinical / Auth (13 mins)",
        "target_minutes": 13,
        "target_seconds": 780,
    },
    {
        "id": "DM_ADMIN",
        "short_name": "DM - Admin / Coding",
        "label": "DM - Admin / Coding (8 mins)",
        "target_minutes": 8,
        "target_seconds": 480,
    },
    {
        "id": "PPA_POSTING",
        "short_name": "PPA - Review / Posting",
        "label": "PPA - Review / Posting (3 mins)",
        "target_minutes": 3,
        "target_seconds": 180,
    },
    {
        "id": "RO_DISPUTE",
        "short_name": "RO - Review / Dispute",
        "label": "RO - Review / Dispute (13 mins)",
        "target_minutes": 13,
        "target_seconds": 780,
    },
]

# NovaArc RCM platform claims catalog with live status and standard benchmarks
PLATFORM_CLAIMS_CATALOG = {
    "CLM-605": {
        "status": "RESUBMIT CLAIM (CALL/IVR)",
        "patient": "MRN126225",
        "provider": "Dr. Amanda Davis",
        "payer": "UnitedHealthcare",
        "short_name": "CR - Call / IVR",
        "target_minutes": 14,
        "target_seconds": 840,
    },
    "CLM-606": {
        "status": "PAID",
        "patient": "MRN126225",
        "provider": "Dr. Amanda Davis",
        "payer": "Aetna",
        "short_name": "PPA - Review / Posting",
        "target_minutes": 3,
        "target_seconds": 180,
    },
    "CLM-604": {
        "status": "PAID",
        "patient": "MRN126225",
        "provider": "Dr. Amanda Davis",
        "payer": "Aetna",
        "short_name": "PPA - Review / Posting",
        "target_minutes": 3,
        "target_seconds": 180,
    },
    "CLM-603": {
        "status": "PAID",
        "patient": "MRN126225",
        "provider": "Dr. Amanda Davis",
        "payer": "Aetna",
        "short_name": "PPA - Review / Posting",
        "target_minutes": 3,
        "target_seconds": 180,
    },
    "CLM-602": {
        "status": "PAID",
        "patient": "MRN126225",
        "provider": "Dr. Amanda Davis",
        "payer": "Aetna",
        "short_name": "PPA - Review / Posting",
        "target_minutes": 3,
        "target_seconds": 180,
    },
    "CLM-601": {
        "status": "PAID",
        "patient": "MRN126225",
        "provider": "Dr. Amanda Davis",
        "payer": "Aetna",
        "short_name": "PPA - Review / Posting",
        "target_minutes": 3,
        "target_seconds": 180,
    },
    "CLM-472": {
        "status": "DENIED",
        "patient": "MRN550664",
        "provider": "Dr. Emily Rodriguez",
        "payer": "Medicare",
        "short_name": "DM - Clinical / Auth",
        "target_minutes": 13,
        "target_seconds": 780,
    },
    "CLM-0012": {
        "status": "RESUBMIT CLAIM (CALL/IVR)",
        "patient": "MRN334211",
        "provider": "Dr. Amanda Davis",
        "payer": "Blue Cross Blue Shield",
        "short_name": "CR - Call / IVR",
        "target_minutes": 14,
        "target_seconds": 840,
    },
    "CLM-0016": {
        "status": "RESUBMIT CLAIM (CALL/IVR)",
        "patient": "MRN884120",
        "provider": "Dr. Amanda Davis",
        "payer": "Cigna",
        "short_name": "CR - Call / IVR",
        "target_minutes": 14,
        "target_seconds": 840,
    },
    "CLM-7722": {
        "status": "RESUBMIT CLAIM (CALL/IVR)",
        "patient": "MRN441092",
        "provider": "Dr. Amanda Davis",
        "payer": "Humana",
        "short_name": "CR - Call / IVR",
        "target_minutes": 14,
        "target_seconds": 840,
    },
    "CLM-001": {
        "status": "RESUBMIT CLAIM (CALL/IVR)",
        "patient": "MRN1001",
        "provider": "Dr. Amanda Davis",
        "payer": "Aetna",
        "short_name": "CR - Call / IVR",
        "target_minutes": 14,
        "target_seconds": 840,
    },
    "CLM-002": {
        "status": "STANDARD CLAIM APPEAL (WRITTEN)",
        "patient": "MRN1002",
        "provider": "Dr. Amanda Davis",
        "payer": "UnitedHealthcare",
        "short_name": "AP - Review / Written",
        "target_minutes": 18,
        "target_seconds": 1080,
    },
    "CLM-003": {
        "status": "CLAIM STATUS CHECK (CALL/IVR)",
        "patient": "MRN1003",
        "provider": "Dr. Amanda Davis",
        "payer": "Medicare",
        "short_name": "SI - Call / IVR",
        "target_minutes": 7,
        "target_seconds": 420,
    },
    "CLM-445522": {
        "status": "RESUBMIT CLAIM (CALL/IVR)",
        "patient": "MRN992011",
        "provider": "Dr. Amanda Davis",
        "payer": "Aetna",
        "short_name": "CR - Call / IVR",
        "target_minutes": 14,
        "target_seconds": 840,
    },
    "CLM1002": {
        "status": "CLEAN CLAIM FOLLOW-UP (CALL/IVR)",
        "patient": "MRN1002",
        "provider": "Dr. Amanda Davis",
        "payer": "Aetna",
        "short_name": "CR - Call / IVR",
        "target_minutes": 14,
        "target_seconds": 840,
    },
    "CLM1003": {
        "status": "DENIAL REVIEW - MEDICAL NECESSITY",
        "patient": "MRN1003",
        "provider": "Dr. Amanda Davis",
        "payer": "UnitedHealthcare",
        "short_name": "DM - Clinical / Auth",
        "target_minutes": 13,
        "target_seconds": 780,
    },
    "CLM1004": {
        "status": "APPEALS SUBMISSION - STANDARD",
        "patient": "MRN1004",
        "provider": "Dr. Amanda Davis",
        "payer": "Medicare",
        "short_name": "AP - Review / Written",
        "target_minutes": 18,
        "target_seconds": 1080,
    }
}


def normalize_claim_key(k: str) -> str:
    return re.sub(r"[^A-Za-z0-9]", "", k or "").upper()


def resolve_platform_claim(raw_id: str, catalog: Optional[dict] = None) -> Optional[dict]:
    if not raw_id:
        return None
    if catalog is None:
        catalog = PLATFORM_CLAIMS_CATALOG
    clean = raw_id.strip().upper()
    norm = normalize_claim_key(clean)
    if not norm:
        return None

    # Exact key match
    if clean in catalog:
        res = dict(catalog[clean])
        res["claim_id"] = clean
        return res

    # Flexible normalized match (e.g. CLM-605, CLM605, or 605)
    target_norms = {norm}
    if not norm.startswith("CLM"):
        target_norms.add(f"CLM{norm}")
    else:
        target_norms.add(norm[3:])

    for cid, info in catalog.items():
        cid_norm = normalize_claim_key(cid)
        cid_strip = cid_norm[3:] if cid_norm.startswith("CLM") else cid_norm
        if cid_norm in target_norms or cid_strip in target_norms:
            res = dict(info)
            res["claim_id"] = cid
            return res

    return None


DEFAULT_RUNNING_CLAIMS: List[Tuple[str, str, str]] = []


class ClaimDialog:
    """
    System-wide Executive Floating Dialogue Box (Claim Work Assistant).
    Adheres to UI/UX Pro Design System:
    - Obsidian Header with Cobalt Accents & Emerald Pulse Indicator
    - Seamless automated claim type & benchmark AHT detection from platform status
    - Blue "Claims Section" quick launcher with top-right corner minimization & center restore
    - Strict distraction prevention (blocks app switching & unapproved websites)
    - Always-on-Top without focus-stealing loops
    """

    def __init__(
        self,
        on_submit: Optional[Callable[[str, Any], None]] = None,
        on_cancel: Optional[Callable[[], None]] = None,
        on_close_claim: Optional[Callable[[str, str], None]] = None,
        on_status_change: Optional[Callable[[str, str], None]] = None,
        running_claims: Optional[List[Any]] = None,
        associate_id: str = "EMP101",
        api_base_url: str = "https://tms-backend-6l5j.onrender.com",
    ):
        self.on_submit = on_submit
        self.on_cancel = on_cancel
        self.on_close_claim = on_close_claim
        self.on_status_change = on_status_change
        self.associate_id = associate_id
        self.api_base_url = api_base_url.rstrip("/")
        # Normalize running claims to mutable list of [cid, desc, status]
        raw_list = running_claims if running_claims is not None else DEFAULT_RUNNING_CLAIMS
        self.running_claims = [[item[0], item[1], item[2]] for item in raw_list]
        self.claim_regex = re.compile(r"\b(?:CLM|CLAIM)[-_]?\d+\b", re.IGNORECASE)
        self.dropdown_visible = False
        self._is_minimized = False
        self.platform_catalog = dict(PLATFORM_CLAIMS_CATALOG)

        # Merge running claims into platform catalog
        for rc in self.running_claims:
            if rc and rc[0] and rc[0] != "UNASSIGNED":
                cid = rc[0].strip().upper()
                if cid not in self.platform_catalog:
                    st = rc[2] if len(rc) > 2 else "RESUBMIT CLAIM (CALL/IVR)"
                    self.platform_catalog[cid] = {
                        "status": st,
                        "patient": rc[1] if len(rc) > 1 else "Shift Claim",
                        "provider": "Assigned Provider",
                        "payer": "Assigned Payer",
                        "short_name": "CR - Call / IVR",
                        "target_minutes": 14,
                        "target_seconds": 840,
                    }

        # Background dynamic sync of employee's live daily claims pool from backend
        def _sync_catalog():
            try:
                endpoints = [
                    f"{self.api_base_url}/api/associate/{self.associate_id}/claims-pool",
                    f"{self.api_base_url}/api/associate/platform-claims"
                ]
                for ep in endpoints:
                    try:
                        r = requests.get(ep, timeout=2.5)
                        if r.status_code == 200:
                            items = r.json()
                            if items and isinstance(items, list):
                                for it in items:
                                    c_id = it.get("claim_id")
                                    if c_id:
                                        self.platform_catalog[c_id.strip().upper()] = {
                                            "status": it.get("status", "RESUBMIT CLAIM (CALL/IVR)"),
                                            "patient": it.get("patient", "MRN"),
                                            "provider": it.get("provider", "Provider"),
                                            "payer": it.get("payer", "Payer"),
                                            "short_name": it.get("claim_type", "CR - Call / IVR"),
                                            "target_minutes": it.get("target_minutes", 14),
                                            "target_seconds": it.get("target_seconds", 840),
                                        }
                                break
                    except Exception:
                        continue
            except Exception:
                pass

        threading.Thread(target=_sync_catalog, daemon=True).start()

        # Windows OS hook, taskbar, and modal state handles
        self._kbd_hook = None
        self._mouse_hook = None
        self._hook_procs = []
        self._taskbar_hwnd = None
        self._sec_taskbar_hwnd = None
        self._is_closing = False
        self._top_hwnd = 0

    def show(
        self,
        current_claim: Optional[str] = None,
        platform_name: str = "NovaArc RCM",
        target_hwnd: int = 0,
        lastly_worked_claim: Optional[str] = None,
    ):
        root = tk.Tk()
        root.title(f"Claim Work Assistant - {platform_name}")

        # Dimension specifications (perfectly balanced compact desktop assistant)
        base_w = 680
        h_collapsed = 420
        h_expanded = 660

        screen_w = root.winfo_screenwidth()
        screen_h = root.winfo_screenheight()
        pos_x = max(0, (screen_w - base_w) // 2)
        pos_y = max(0, (screen_h - h_collapsed) // 2)

        # Dynamic positioning and sizing according to target application window
        if target_hwnd:
            try:
                import ctypes
                from ctypes import wintypes
                u32 = ctypes.windll.user32

                class RECT(ctypes.Structure):
                    _fields_ = [
                        ("left", wintypes.LONG),
                        ("top", wintypes.LONG),
                        ("right", wintypes.LONG),
                        ("bottom", wintypes.LONG),
                    ]

                if u32.IsWindow(target_hwnd):
                    # If target application is minimized (iconic), restore it so the associate sees the platform
                    if u32.IsIconic(target_hwnd):
                        u32.ShowWindow(target_hwnd, 9)  # SW_RESTORE
                        u32.SetForegroundWindow(target_hwnd)

                    rect = RECT()
                    if u32.GetWindowRect(target_hwnd, ctypes.byref(rect)):
                        app_w = rect.right - rect.left
                        app_h = rect.bottom - rect.top

                        if app_w > 150 and app_h > 150:
                            # Fit dialog width comfortably inside target application
                            if app_w < 660:
                                base_w = max(450, app_w - 24)
                            else:
                                base_w = 660

                            # Center dialog precisely over target application window
                            pos_x = rect.left + max(0, (app_w - base_w) // 2)
                            pos_y = rect.top + max(20, (app_h - h_collapsed) // 2)
            except Exception as e:
                print(f"[Dialog] Application geometry fit notice: {e}")

        # Keep safely within visible screen boundaries
        pos_x = max(10, min(pos_x, screen_w - base_w - 10))
        pos_y = max(10, min(pos_y, screen_h - h_collapsed - 40))

        root.geometry(f"{base_w}x{h_collapsed}+{pos_x}+{pos_y}")
        root.resizable(False, False)

        # Enforce System-wide Always-On-Top cleanly without fighting Windows DWM / Win+Tab
        root.attributes("-topmost", True)
        root.lift()

        # Win32 HWND_TOPMOST reinforcement once on launch (no blinking loop)
        top_hwnd = 0
        try:
            import ctypes
            u32 = ctypes.windll.user32
            root.update_idletasks()
            hwnd = root.winfo_id()
            top_hwnd = u32.GetAncestor(hwnd, 2) or hwnd  # GA_ROOT
            self._top_hwnd = top_hwnd
            u32.SetWindowPos(top_hwnd, -1, 0, 0, 0, 0, 0x0001 | 0x0002)  # HWND_TOPMOST | SWP_NOSIZE | SWP_NOMOVE
            u32.SetForegroundWindow(top_hwnd)
        except Exception:
            pass

        self._is_closing = False

        # Hide Windows Desktop Taskbar while dialog is active so bottom desktop bar is not shown
        try:
            import ctypes
            u32 = ctypes.windll.user32
            self._taskbar_hwnd = u32.FindWindowW("Shell_TrayWnd", None)
            if self._taskbar_hwnd and u32.IsWindow(self._taskbar_hwnd):
                u32.ShowWindow(self._taskbar_hwnd, 0)  # SW_HIDE
            self._sec_taskbar_hwnd = u32.FindWindowW("Shell_SecondaryTrayWnd", None)
            if self._sec_taskbar_hwnd and u32.IsWindow(self._sec_taskbar_hwnd):
                u32.ShowWindow(self._sec_taskbar_hwnd, 0)  # SW_HIDE
        except Exception as e:
            print(f"[Dialog] Taskbar hide notice: {e}")

        # --- Strict Low-Level OS Hooks (Blocks Alt+Tab, App Switching, Tab Switching, Outside Clicks) ---
        try:
            import ctypes
            from ctypes import wintypes
            u32 = ctypes.windll.user32

            class KBDLLHOOKSTRUCT(ctypes.Structure):
                _fields_ = [
                    ("vkCode", wintypes.DWORD),
                    ("scanCode", wintypes.DWORD),
                    ("flags", wintypes.DWORD),
                    ("time", wintypes.DWORD),
                    ("dwExtraInfo", ctypes.c_size_t),
                ]

            class POINT(ctypes.Structure):
                _fields_ = [("x", wintypes.LONG), ("y", wintypes.LONG)]

            class MSLLHOOKSTRUCT(ctypes.Structure):
                _fields_ = [
                    ("pt", POINT),
                    ("mouseData", wintypes.DWORD),
                    ("flags", wintypes.DWORD),
                    ("time", wintypes.DWORD),
                    ("dwExtraInfo", ctypes.c_size_t),
                ]

            class RECT(ctypes.Structure):
                _fields_ = [
                    ("left", wintypes.LONG),
                    ("top", wintypes.LONG),
                    ("right", wintypes.LONG),
                    ("bottom", wintypes.LONG),
                ]

            HOOKPROC = ctypes.WINFUNCTYPE(ctypes.c_longlong, ctypes.c_int, wintypes.WPARAM, wintypes.LPARAM)
            u32.SetWindowsHookExW.argtypes = [ctypes.c_int, HOOKPROC, wintypes.HINSTANCE, wintypes.DWORD]
            u32.SetWindowsHookExW.restype = wintypes.HHOOK
            u32.CallNextHookEx.argtypes = [wintypes.HHOOK, ctypes.c_int, wintypes.WPARAM, wintypes.LPARAM]
            u32.CallNextHookEx.restype = ctypes.c_longlong
            u32.UnhookWindowsHookEx.argtypes = [wintypes.HHOOK]
            u32.UnhookWindowsHookEx.restype = wintypes.BOOL
            u32.WindowFromPoint.argtypes = [POINT]
            u32.WindowFromPoint.restype = wintypes.HWND
            try:
                u32.WindowFromPhysicalPoint.argtypes = [POINT]
                u32.WindowFromPhysicalPoint.restype = wintypes.HWND
            except Exception:
                pass

            my_pid = os.getpid()

            # 1. Low-Level Keyboard Hook Callback
            def _ll_kbd_proc(nCode, wParam, lParam):
                if nCode >= 0 and not self._is_closing:
                    try:
                        kb = KBDLLHOOKSTRUCT.from_address(lParam)
                        vk = kb.vkCode
                        flags = kb.flags

                        is_alt = bool(flags & 0x20) or bool(u32.GetAsyncKeyState(0x12) & 0x8000) or bool(u32.GetAsyncKeyState(0xA4) & 0x8000) or bool(u32.GetAsyncKeyState(0xA5) & 0x8000)
                        is_ctrl = bool(u32.GetAsyncKeyState(0x11) & 0x8000) or bool(u32.GetAsyncKeyState(0xA2) & 0x8000) or bool(u32.GetAsyncKeyState(0xA3) & 0x8000)

                        # Strictly Block Alt + Tab (Tab pressed with any Alt state)
                        if vk == 0x09 and is_alt:
                            return 1

                        # Strictly Block Alt key itself to prevent Windows Task Switcher from initiating
                        if vk in (0x12, 0xA4, 0xA5):
                            return 1

                        # Block Alt + Esc
                        if vk == 0x1B and is_alt:
                            return 1

                        # Block Alt + Space (Window System Menu)
                        if vk == 0x20 and is_alt:
                            return 1

                        # Block Windows Key (Start Menu, Win+Tab, Win+D, Win+E, Win+R, Win+X, etc.)
                        if vk in (0x5B, 0x5C):
                            return 1

                        # Block Ctrl + Esc (Start Menu)
                        if vk == 0x1B and is_ctrl:
                            return 1

                        # Block Browser Tab Switching & Shortcut combos
                        if is_ctrl:
                            # Ctrl + Tab, Ctrl + Shift + Tab, Ctrl + PgUp, Ctrl + PgDn (Browser Tab Switch)
                            if vk in (0x09, 0x21, 0x22):
                                return 1
                            # Ctrl + 1..9 (Browser Tab Switch)
                            if 0x31 <= vk <= 0x39:
                                return 1
                            # Ctrl + T (New Tab), Ctrl + W (Close Tab), Ctrl + N, Ctrl + L, Ctrl + H, Ctrl + J, Ctrl + O
                            if vk in (ord('T'), ord('W'), ord('N'), ord('L'), ord('H'), ord('J'), ord('O')):
                                return 1

                        # Block Alt + D (Browser address bar), F6 (Address bar cycle)
                        if (vk == ord('D') and is_alt) or vk == 0x75:
                            return 1

                        # Block Alt + F4 (Bypassing dialog)
                        if vk == 0x73 and is_alt:
                            return 1
                    except BaseException:
                        pass

                try:
                    return u32.CallNextHookEx(None, nCode, wParam, lParam)
                except BaseException:
                    return 0

            # 2. Low-Level Mouse Hook Callback (Absorbs all clicks outside dialog without corrupting external apps)
            def _ll_mouse_proc(nCode, wParam, lParam):
                if nCode >= 0 and not self._is_closing and self._top_hwnd:
                    try:
                        if u32.IsWindow(self._top_hwnd):
                            ms = MSLLHOOKSTRUCT.from_address(lParam)
                            mx, my = ms.pt.x, ms.pt.y
                            pt = POINT(mx, my)

                            # 1. Identify which window handle is directly under the mouse pointer
                            w_at = None
                            try:
                                w_at = u32.WindowFromPhysicalPoint(pt)
                            except Exception:
                                pass
                            if not w_at:
                                try:
                                    w_at = u32.WindowFromPoint(pt)
                                except Exception:
                                    pass

                            is_inside = False
                            if w_at:
                                if w_at == self._top_hwnd or w_at == hwnd:
                                    is_inside = True
                                elif u32.GetAncestor(w_at, 2) == self._top_hwnd:  # GA_ROOT
                                    is_inside = True
                                elif u32.IsChild(self._top_hwnd, w_at):
                                    is_inside = True
                                else:
                                    pid = wintypes.DWORD()
                                    u32.GetWindowThreadProcessId(w_at, ctypes.byref(pid))
                                    if pid.value == my_pid:
                                        is_inside = True

                            # 2. Tkinter widget geometry fallback
                            if not is_inside:
                                try:
                                    rx = root.winfo_rootx()
                                    ry = root.winfo_rooty()
                                    rw = root.winfo_width()
                                    rh = root.winfo_height()
                                    if (rx <= mx <= rx + rw + 20) and (ry <= my <= ry + rh + 20):
                                        is_inside = True
                                except Exception:
                                    pass

                            # 3. Win32 Window rect fallback
                            if not is_inside:
                                win_rect = RECT()
                                if u32.GetWindowRect(self._top_hwnd, ctypes.byref(win_rect)):
                                    if (win_rect.left <= mx <= win_rect.right and win_rect.top <= my <= win_rect.bottom):
                                        is_inside = True

                            # When minimized to top-right corner, clicks on the mini widget or the NovaArc browser pass freely
                            if self._is_minimized:
                                return u32.CallNextHookEx(None, nCode, wParam, lParam)

                            # Strictly discard ALL mouse button & wheel events OUTSIDE the dialog when modal is active
                            if wParam in (0x0201, 0x0202, 0x0203, 0x0204, 0x0205, 0x0207, 0x0208, 0x020A, 0x020B, 0x020C, 0x020E):
                                if not is_inside:
                                    try:
                                        u32.SetForegroundWindow(self._top_hwnd)
                                    except Exception:
                                        pass
                                    return 1
                    except BaseException:
                        pass

                try:
                    return u32.CallNextHookEx(None, nCode, wParam, lParam)
                except BaseException:
                    return 0

            self._kbd_callback = HOOKPROC(_ll_kbd_proc)
            self._mouse_callback = HOOKPROC(_ll_mouse_proc)
            self._hook_procs = [self._kbd_callback, self._mouse_callback]

            # WH_KEYBOARD_LL = 13, WH_MOUSE_LL = 14
            self._kbd_hook = u32.SetWindowsHookExW(13, self._kbd_callback, None, 0)
            self._mouse_hook = u32.SetWindowsHookExW(14, self._mouse_callback, None, 0)
        except Exception as e:
            print(f"[Dialog] Win32 hook installation notice: {e}")

        # Set initial focus smoothly to the entry field
        def set_initial_focus():
            if self._is_closing:
                return
            try:
                entry_field.focus_force()
                if initial_val:
                    entry_field.select_range(0, tk.END)
                    entry_field.icursor(tk.END)
            except Exception:
                pass
        root.after(100, set_initial_focus)

        # --- Determine Lastly Worked Claim/Denial ---
        last_worked_val = (lastly_worked_claim or "").strip().upper()
        if not last_worked_val or "NONE" in last_worked_val or last_worked_val == "UNASSIGNED":
            try:
                from claim_context import ClaimContextManager
                mgr = ClaimContextManager()
                last_worked_val = mgr.get_last_worked_claim_id(exclude_claim_id=current_claim)
            except Exception:
                pass

        if not last_worked_val or "NONE" in last_worked_val or last_worked_val == "UNASSIGNED":
            for rc in self.running_claims:
                if len(rc) > 0 and rc[0]:
                    cid = str(rc[0]).strip().upper()
                    if cid and cid != "UNASSIGNED" and (not current_claim or cid != current_claim.strip().upper()):
                        last_worked_val = cid
                        break

        if not last_worked_val or "NONE" in last_worked_val or last_worked_val == "UNASSIGNED":
            # Real-time discovery from backend API / Supabase
            try:
                r = requests.get(f"{self.api_base_url}/api/associate/{self.associate_id}/today", timeout=0.8)
                if r.status_code == 200:
                    d = r.json()
                    rec = d.get("recent_claims", [])
                    for item in rec:
                        c = item.get("claim_id")
                        if c and c != "UNASSIGNED" and (not current_claim or str(c).strip().upper() != current_claim.strip().upper()):
                            last_worked_val = str(c).strip().upper()
                            break
            except Exception:
                pass

        if not last_worked_val or "NONE" in last_worked_val or last_worked_val == "UNASSIGNED":
            # Deep discovery from database or CSV
            try:
                db_path = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "tms.db"))
                if os.path.exists(db_path):
                    con = sqlite3.connect(db_path)
                    cur = con.cursor()
                    cur.execute(
                        "SELECT claim_id FROM events WHERE claim_id IS NOT NULL AND claim_id != 'UNASSIGNED' ORDER BY id DESC LIMIT 1"
                    )
                    row = cur.fetchone()
                    con.close()
                    if row and row[0]:
                        last_worked_val = str(row[0]).strip().upper()
            except Exception:
                pass

        if not last_worked_val or "NONE" in last_worked_val:
            last_worked_val = "None (Shift Start)"

        # --- Top Banner: Lastly worked claim/denial (prominent, bold, large) ---
        last_worked_bar = tk.Frame(root, bg="#0f172a", padx=16, pady=8)
        last_worked_bar.pack(fill="x", side="top")

        lbl_prefix = tk.Label(
            last_worked_bar,
            text="lastly worked claim/denial: ",
            font=("Segoe UI", 9, "bold"),
            fg="#94a3b8",
            bg="#0f172a"
        )
        lbl_prefix.pack(side="left")

        lbl_claim = tk.Label(
            last_worked_bar,
            text=last_worked_val,
            font=("Consolas", 15, "bold"),
            fg="#4ade80",
            bg="#0f172a"
        )
        lbl_claim.pack(side="left", padx=(4, 0))

        # --- Top-Right Minimized Floating Chip Widget ---
        mini_frame = tk.Frame(root, bg="#090d16", bd=2, relief="solid", highlightthickness=1, highlightbackground="#2563eb", cursor="hand2")

        mini_inner = tk.Frame(mini_frame, bg="#090d16", cursor="hand2")
        mini_inner.pack(fill="both", expand=True, padx=12, pady=6)

        mini_icon = tk.Label(
            mini_inner,
            text="📋",
            font=("Segoe UI", 12),
            fg="#60a5fa",
            bg="#090d16",
            cursor="hand2"
        )
        mini_icon.pack(side="left", padx=(0, 8))

        mini_text_box = tk.Frame(mini_inner, bg="#090d16", cursor="hand2")
        mini_text_box.pack(side="left", fill="both", expand=True)

        mini_title = tk.Label(
            mini_text_box,
            text="Claim Work Assistant",
            font=("Segoe UI", 9, "bold"),
            fg="#ffffff",
            bg="#090d16",
            cursor="hand2"
        )
        mini_title.pack(anchor="w")

        mini_sub = tk.Label(
            mini_text_box,
            text="Click to return & enter claim",
            font=("Segoe UI", 8),
            fg="#93c5fd",
            bg="#090d16",
            cursor="hand2"
        )
        mini_sub.pack(anchor="w")

        mini_dot = tk.Label(
            mini_inner,
            text="●",
            font=("Segoe UI", 10, "bold"),
            fg="#22c55e",
            bg="#090d16",
            cursor="hand2"
        )
        mini_dot.pack(side="right")

        def open_claims_section_and_minimize():
            try:
                import webbrowser
                webbrowser.open("https://krishna-caare.github.io/novaarc-rcm/#/claims")
            except Exception:
                pass

            self._is_minimized = True

            last_worked_bar.pack_forget()
            top_accent.pack_forget()
            header_frame.pack_forget()
            body_frame.pack_forget()

            mini_frame.pack(fill="both", expand=True)
            mini_w = 320
            mini_h = 50
            root.geometry(f"{mini_w}x{mini_h}+{screen_w - mini_w - 20}+20")
            root.attributes("-topmost", True)
            root.lift()

        def restore_to_center(event=None):
            if not self._is_minimized:
                return
            self._is_minimized = False
            mini_frame.pack_forget()

            root.geometry(f"{base_w}x{h_collapsed}+{pos_x}+{pos_y}")

            last_worked_bar.pack(fill="x", side="top")
            top_accent.pack(fill="x", side="top")
            header_frame.pack(fill="x", side="top")
            body_frame.pack(fill="both", expand=True)

            root.attributes("-topmost", True)
            root.lift()
            root.after(80, lambda: entry_field.focus_force())

        for w in (mini_frame, mini_inner, mini_icon, mini_text_box, mini_title, mini_sub, mini_dot):
            w.bind("<Button-1>", restore_to_center)

        # --- Top Decorative Accent Line (Light Green) ---
        top_accent = tk.Frame(root, bg="#22c55e", height=3)
        top_accent.pack(fill="x", side="top")

        # --- Executive Header Bar (Natural sizing, clearly visible) ---
        header_frame = tk.Frame(root, bg="#090d16", padx=16, pady=10)
        header_frame.pack(fill="x", side="top")

        # Left Icon Badge (Light Green)
        icon_box = tk.Frame(header_frame, bg="#16a34a", width=30, height=30)
        icon_box.pack(side="left", padx=(0, 12))
        icon_box.pack_propagate(False)
        icon_lbl = tk.Label(
            icon_box,
            text="TMS",
            font=("Segoe UI", 8, "bold"),
            fg="#ffffff",
            bg="#16a34a"
        )
        icon_lbl.pack(expand=True)

        # Title & Subtitle Container
        title_box = tk.Frame(header_frame, bg="#090d16")
        title_box.pack(side="left")

        title_lbl = tk.Label(
            title_box,
            text="Claim Work Assistant",
            font=("Segoe UI", 12, "bold"),
            fg="#f8fafc",
            bg="#090d16"
        )
        title_lbl.pack(anchor="w")

        subtitle_lbl = tk.Label(
            title_box,
            text="Active session claim tracking",
            font=("Segoe UI", 9),
            fg="#86efac",
            bg="#090d16"
        )
        subtitle_lbl.pack(anchor="w")

        # Right Platform Badge
        clean_platform = "NovaArc RCM" if ("NovaArc" in platform_name or not platform_name) else platform_name
        if len(clean_platform) > 22:
            clean_platform = clean_platform[:19] + "..."

        right_badge_frame = tk.Frame(header_frame, bg="#1e293b", padx=10, pady=4, relief="solid", bd=1, highlightthickness=0)
        right_badge_frame.pack(side="right")

        pulse_dot = tk.Label(
            right_badge_frame,
            text="*",
            font=("Segoe UI", 9, "bold"),
            fg="#22c55e",
            bg="#1e293b"
        )
        pulse_dot.pack(side="left", padx=(0, 5))

        platform_badge = tk.Label(
            right_badge_frame,
            text=clean_platform,
            font=("Segoe UI", 8, "bold"),
            fg="#86efac",
            bg="#1e293b"
        )
        platform_badge.pack(side="left")

        # Prominent Blue Action Button: Claims Section
        claims_section_btn = tk.Button(
            header_frame,
            text="↗ Claims Section",
            font=("Segoe UI", 9, "bold"),
            fg="#ffffff",
            bg="#2563eb",
            activeforeground="#ffffff",
            activebackground="#1d4ed8",
            relief="flat",
            bd=0,
            padx=12,
            pady=4,
            cursor="hand2",
            command=open_claims_section_and_minimize
        )
        claims_section_btn.pack(side="right", padx=(0, 10))

        # --- Main Body Container ---
        body_frame = tk.Frame(root, bg="#ffffff", padx=22, pady=14)
        body_frame.pack(fill="both", expand=True)

        # Info Prompt Box
        prompt_box = tk.Frame(body_frame, bg="#f0fdf4", padx=14, pady=10, highlightthickness=1, highlightbackground="#bbf7d0")
        prompt_box.pack(fill="x", pady=(0, 12))

        prompt_title = tk.Label(
            prompt_box,
            text="Select or enter the claim you are working on",
            font=("Segoe UI", 9, "bold"),
            fg="#14532d",
            bg="#f0fdf4",
            anchor="w"
        )
        prompt_title.pack(fill="x")

        prompt_sub = tk.Label(
            prompt_box,
            text="Claim type & target AHT will be automatically detected from your NovaArc platform status.",
            font=("Segoe UI", 8),
            fg="#166534",
            bg="#f0fdf4",
            anchor="w"
        )
        prompt_sub.pack(fill="x", pady=(2, 0))

        # Fields Container: Claim ID (Full width, Claim Type button removed)
        fields_container = tk.Frame(body_frame, bg="#ffffff")
        fields_container.pack(fill="x", pady=(0, 4))

        dd_label = tk.Label(
            fields_container,
            text="Claim ID",
            font=("Segoe UI", 9, "bold"),
            fg="#334155",
            bg="#ffffff"
        )
        dd_label.pack(anchor="w", pady=(0, 4))

        # Initial Claim value
        initial_val = current_claim if current_claim and current_claim != "UNASSIGNED" else ""
        entry_var = tk.StringVar(value=initial_val)

        # Input Row Frame (Full width)
        input_container = tk.Frame(fields_container, bg="#ffffff", highlightthickness=2, highlightbackground="#cbd5e1", highlightcolor="#16a34a")
        input_container.pack(fill="x")

        entry_field = tk.Entry(
            input_container,
            textvariable=entry_var,
            font=("Consolas", 12, "bold"),
            bg="#ffffff",
            fg="#0f172a",
            relief="flat",
            bd=0
        )
        entry_field.pack(side="left", fill="x", expand=True, padx=(10, 4), ipady=6)

        # Dropdown Toggle Button (Select Existing)
        toggle_btn = tk.Button(
            input_container,
            text="Select Existing",
            font=("Segoe UI", 8, "bold"),
            bg="#f0fdf4",
            fg="#15803d",
            activebackground="#dcfce7",
            activeforeground="#14532d",
            relief="flat",
            bd=0,
            padx=10,
            pady=4,
            cursor="hand2"
        )
        toggle_btn.pack(side="right", padx=(2, 4), pady=3)

        # In-Dialog Status & Validation Feedback Box
        validation_box = tk.Frame(body_frame, bg="#f8fafc", padx=12, pady=8, highlightthickness=1, highlightbackground="#e2e8f0")
        validation_box.pack(fill="x", pady=(6, 8))

        val_icon = tk.Label(
            validation_box,
            text="ℹ",
            font=("Segoe UI", 10, "bold"),
            fg="#2563eb",
            bg="#f8fafc"
        )
        val_icon.pack(side="left", padx=(0, 8))

        val_lbl = tk.Label(
            validation_box,
            text="Type your assigned Claim ID (e.g. CLM-605) or click 'Claims Section' to view in NovaArc RCM.",
            font=("Segoe UI", 9),
            fg="#64748b",
            bg="#f8fafc",
            anchor="w"
        )
        val_lbl.pack(side="left", fill="x", expand=True)

        detected_claim_holder = {"val": None}

        def _on_entry_changed(*args):
            raw_val = entry_var.get().strip().upper()
            if not raw_val:
                validation_box.configure(bg="#f8fafc", highlightbackground="#e2e8f0")
                val_icon.configure(text="ℹ", fg="#2563eb", bg="#f8fafc")
                val_lbl.configure(
                    text="Type your assigned Claim ID (e.g. CLM-605) or click 'Claims Section' to view in NovaArc RCM.",
                    fg="#64748b",
                    bg="#f8fafc"
                )
                detected_claim_holder["val"] = None
                input_container.configure(highlightbackground="#cbd5e1", highlightcolor="#16a34a")
                return

            claim_match = resolve_platform_claim(raw_val, self.platform_catalog)
            if claim_match:
                detected_claim_holder["val"] = claim_match
                st_name = claim_match.get("status", "RESUBMIT CLAIM (CALL/IVR)")
                ct_name = claim_match.get("short_name", "CR - Call / IVR")
                tgt_m = claim_match.get("target_minutes", 14)

                validation_box.configure(bg="#f0fdf4", highlightbackground="#86efac")
                val_icon.configure(text="✓", fg="#15803d", bg="#f0fdf4")
                val_lbl.configure(
                    text=f"Platform Status: {st_name}  →  Detected: {ct_name} (AHT Target: {tgt_m}m)",
                    fg="#15803d",
                    bg="#f0fdf4"
                )
                input_container.configure(highlightbackground="#16a34a", highlightcolor="#16a34a")
            else:
                detected_claim_holder["val"] = None
                validation_box.configure(bg="#fef2f2", highlightbackground="#fca5a5")
                val_icon.configure(text="⚠️", fg="#b91c1c", bg="#fef2f2")
                val_lbl.configure(
                    text="Please enter the claim ID which is present in your login claims section (e.g. CLM-605).",
                    fg="#b91c1c",
                    bg="#fef2f2"
                )
                input_container.configure(highlightbackground="#ef4444", highlightcolor="#ef4444")

            if self.dropdown_visible:
                populate_dropdown_list(raw_val)

        entry_var.trace_add("write", _on_entry_changed)

        # Trigger initial detection if initial_val was set
        if initial_val:
            root.after(50, _on_entry_changed)

        # Notification / Toast banner for completed claims
        toast_frame = tk.Frame(body_frame, bg="#ecfdf5", padx=8, pady=4, highlightthickness=1, highlightbackground="#10b981")
        toast_lbl = tk.Label(
            toast_frame,
            text="",
            font=("Segoe UI", 7, "bold"),
            fg="#065f46",
            bg="#ecfdf5"
        )
        toast_lbl.pack(side="left")

        def show_toast(msg: str):
            toast_lbl.configure(text=f"[OK] {msg}")
            toast_frame.pack(fill="x", pady=(0, 6), before=input_container)
            root.after(3500, lambda: toast_frame.pack_forget())

        # --- Dropdown Menu Panel (In-Window for 100% Stability & Zero-Glitch) ---
        dropdown_frame = tk.Frame(body_frame, bg="#ffffff", bd=1, relief="solid", highlightthickness=1, highlightbackground="#94a3b8")

        canvas = tk.Canvas(dropdown_frame, bg="#f8fafc", highlightthickness=0, height=170)
        scrollbar = tk.Scrollbar(dropdown_frame, orient="vertical", command=canvas.yview)
        scrollable_frame = tk.Frame(canvas, bg="#f8fafc")

        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )
        claims_canvas_window = canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        def _on_claims_canvas_resize(e):
            canvas.itemconfig(claims_canvas_window, width=e.width)
        canvas.bind("<Configure>", _on_claims_canvas_resize)
        canvas.configure(yscrollcommand=scrollbar.set)

        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        def _scroll_canvas(target_canvas, delta):
            if not delta or not target_canvas.winfo_exists():
                return
            if abs(delta) >= 120:
                steps = int(-1 * (delta / 120) * 2)
            elif delta > 0:
                steps = -1
            else:
                steps = 1
            try:
                target_canvas.yview_scroll(steps, "units")
            except Exception:
                pass

        def _on_claims_mousewheel(event):
            _scroll_canvas(canvas, getattr(event, "delta", 0))

        canvas.bind("<MouseWheel>", _on_claims_mousewheel)
        scrollable_frame.bind("<MouseWheel>", _on_claims_mousewheel)
        dropdown_frame.bind("<MouseWheel>", _on_claims_mousewheel)
        scrollbar.bind("<MouseWheel>", _on_claims_mousewheel)

        def populate_dropdown_list(filter_text=""):
            for widget in scrollable_frame.winfo_children():
                widget.destroy()

            filt = filter_text.strip().upper()
            available_claims = []
            seen_cids = set()

            for cid, cdata in self.platform_catalog.items():
                seen_cids.add(cid.upper())
                pname = cdata.get("patient") or "Assigned Claim"
                st = cdata.get("status") or "IN_PROGRESS"
                ctype = cdata.get("short_name") or "CR - Call / IVR"
                available_claims.append((cid, pname, st, ctype))

            for rc in self.running_claims:
                if rc and rc[0] and rc[0].upper() not in seen_cids and rc[0] != "UNASSIGNED":
                    seen_cids.add(rc[0].upper())
                    available_claims.append((rc[0], rc[1] if len(rc) > 1 else "", rc[2] if len(rc) > 2 else "IN_PROGRESS", "CR - Call / IVR"))

            filtered_claims = [
                c for c in available_claims
                if not filt or filt in c[0].upper() or filt in c[1].upper() or filt in c[2].upper()
            ]

            if not filtered_claims:
                no_res = tk.Label(
                    scrollable_frame,
                    text="No matching claims found in platform claims section.",
                    font=("Segoe UI", 8),
                    fg="#b91c1c",
                    bg="#f8fafc",
                    pady=16
                )
                no_res.pack(fill="x")
                no_res.bind("<MouseWheel>", _on_claims_mousewheel)
                return

            for item in filtered_claims:
                cid = item[0]
                pname = item[1]
                curr_status = item[2]
                ctype_lbl = item[3]

                row = tk.Frame(scrollable_frame, bg="#ffffff", padx=10, pady=7, highlightthickness=1, highlightbackground="#e2e8f0")
                row.pack(fill="x", padx=4, pady=3)

                info_frame = tk.Frame(row, bg="#ffffff", cursor="hand2")
                info_frame.pack(side="left", fill="x", expand=True)

                cid_lbl = tk.Label(
                    info_frame,
                    text=cid,
                    font=("Consolas", 10, "bold"),
                    fg="#0f172a",
                    bg="#ffffff",
                    cursor="hand2"
                )
                cid_lbl.pack(side="left")

                pat_text = f" ({pname})" if pname else ""
                pat_lbl = tk.Label(
                    info_frame,
                    text=f"{pat_text}  •  {ctype_lbl}",
                    font=("Segoe UI", 8),
                    fg="#64748b",
                    bg="#ffffff",
                    cursor="hand2"
                )
                pat_lbl.pack(side="left", padx=(4, 0))

                s_bg = "#dcfce7" if "PAID" in curr_status.upper() else ("#fee2e2" if "DENI" in curr_status.upper() else "#fef3c7")
                s_fg = "#15803d" if "PAID" in curr_status.upper() else ("#b91c1c" if "DENI" in curr_status.upper() else "#b45309")

                status_lbl = tk.Label(
                    row,
                    text=curr_status,
                    font=("Segoe UI", 8, "bold"),
                    fg=s_fg,
                    bg=s_bg,
                    padx=8,
                    pady=2,
                    cursor="hand2"
                )
                status_lbl.pack(side="right")

                def _select_claim(selected_cid=cid):
                    entry_var.set(selected_cid)
                    toggle_dropdown(force_close=True)
                    entry_field.focus_set()

                for w in (row, info_frame, cid_lbl, pat_lbl, status_lbl):
                    w.bind("<Button-1>", lambda e, scid=cid: _select_claim(scid))
                    w.bind("<MouseWheel>", _on_claims_mousewheel)

        def toggle_dropdown(force_close=False):
            if self.dropdown_visible or force_close:
                dropdown_frame.pack_forget()
                root.geometry(f"{base_w}x{h_collapsed}+{pos_x}+{pos_y}")
                toggle_btn.configure(text="Select Existing", bg="#f0fdf4", fg="#15803d")
                self.dropdown_visible = False
            else:
                populate_dropdown_list(entry_var.get())
                dropdown_frame.pack(fill="x", pady=(0, 10), before=btn_frame)
                root.geometry(f"{base_w}x{h_expanded}+{pos_x}+{pos_y}")
                toggle_btn.configure(text="Close List", bg="#dcfce7", fg="#14532d")
                self.dropdown_visible = True
            root.lift()

        toggle_btn.configure(command=toggle_dropdown)

        def _on_global_mousewheel(event):
            if getattr(self, "dropdown_visible", False) and canvas.winfo_exists():
                _scroll_canvas(canvas, getattr(event, "delta", 0))
                return "break"

        root.bind_all("<MouseWheel>", _on_global_mousewheel)

        # --- Action Buttons Bar ---
        btn_frame = tk.Frame(body_frame, bg="#ffffff")
        btn_frame.pack(fill="x", side="bottom", pady=(14, 0))

        def _cleanup_and_close():
            if self._is_closing:
                return
            self._is_closing = True

            try:
                root.unbind_all("<MouseWheel>")
            except Exception:
                pass

            # 1. Unhook OS low-level hooks immediately
            try:
                import ctypes
                u32 = ctypes.windll.user32
                if self._kbd_hook:
                    u32.UnhookWindowsHookEx(self._kbd_hook)
                    self._kbd_hook = None
                if self._mouse_hook:
                    u32.UnhookWindowsHookEx(self._mouse_hook)
                    self._mouse_hook = None
            except Exception as e:
                print(f"[Dialog] Unhook notice: {e}")
            self._hook_procs.clear()

            # 2. Restore Windows desktop taskbar immediately
            try:
                import ctypes
                u32 = ctypes.windll.user32
                if self._taskbar_hwnd and u32.IsWindow(self._taskbar_hwnd):
                    u32.ShowWindow(self._taskbar_hwnd, 5)
                if self._sec_taskbar_hwnd and u32.IsWindow(self._sec_taskbar_hwnd):
                    u32.ShowWindow(self._sec_taskbar_hwnd, 5)
            except Exception as e:
                print(f"[Dialog] Taskbar restore notice: {e}")
            finally:
                self._taskbar_hwnd = None
                self._sec_taskbar_hwnd = None

            # 3. Restore input and foreground focus directly to target application
            if target_hwnd:
                try:
                    import ctypes
                    u32 = ctypes.windll.user32
                    if u32.IsWindow(target_hwnd):
                        if u32.IsIconic(target_hwnd):
                            u32.ShowWindow(target_hwnd, 9)
                        u32.SetForegroundWindow(target_hwnd)
                except Exception:
                    pass

            try:
                root.grab_release()
            except Exception:
                pass

            try:
                root.destroy()
            except Exception:
                pass

        def handle_confirm():
            raw_val = entry_var.get().strip().upper()
            if not raw_val:
                validation_box.configure(bg="#fef2f2", highlightbackground="#fca5a5")
                val_icon.configure(text="⚠️", fg="#b91c1c", bg="#fef2f2")
                val_lbl.configure(
                    text="Please enter the claim ID which is present in your login claims section (e.g. CLM-605).",
                    fg="#b91c1c",
                    bg="#fef2f2"
                )
                entry_field.focus_set()
                return

            claim_match = resolve_platform_claim(raw_val, self.platform_catalog)
            if not claim_match:
                validation_box.configure(bg="#fef2f2", highlightbackground="#fca5a5")
                val_icon.configure(text="⚠️", fg="#b91c1c", bg="#fef2f2")
                val_lbl.configure(
                    text="Enter the claim ID which is present in your login claim section (e.g. CLM-605).",
                    fg="#b91c1c",
                    bg="#fef2f2"
                )
                entry_field.focus_set()
                return

            final_claim = claim_match["claim_id"]
            detected_type = {
                "id": claim_match.get("id") or "CR_CALL",
                "short_name": claim_match.get("short_name", "CR - Call / IVR"),
                "label": f"{claim_match.get('short_name', 'CR - Call / IVR')} ({claim_match.get('target_minutes', 14)} mins)",
                "target_minutes": claim_match.get("target_minutes", 14),
                "target_seconds": claim_match.get("target_seconds", 840),
                "platform_status": claim_match.get("status")
            }

            _cleanup_and_close()
            if self.on_submit:
                try:
                    self.on_submit(final_claim, detected_type)
                except TypeError:
                    self.on_submit(final_claim)

        def handle_cancel():
            _cleanup_and_close()
            if self.on_cancel:
                self.on_cancel()

        cancel_btn = tk.Button(
            btn_frame,
            text="Cancel",
            command=handle_cancel,
            bg="#ffffff",
            fg="#475569",
            activebackground="#f8fafc",
            activeforeground="#0f172a",
            relief="solid",
            bd=1,
            font=("Segoe UI", 9, "bold"),
            padx=20,
            pady=6,
            cursor="hand2"
        )
        cancel_btn.pack(side="left")

        submit_btn = tk.Button(
            btn_frame,
            text="Continue",
            command=handle_confirm,
            bg="#16a34a",
            fg="#ffffff",
            activebackground="#15803d",
            activeforeground="#ffffff",
            relief="flat",
            bd=0,
            font=("Segoe UI", 10, "bold"),
            padx=24,
            pady=6,
            cursor="hand2"
        )
        submit_btn.pack(side="right")

        # Keyboard bindings
        root.bind("<Return>", lambda e: handle_confirm())
        root.bind("<Escape>", lambda e: toggle_dropdown(force_close=True) if self.dropdown_visible else handle_cancel())
        root.bind("<Down>", lambda e: toggle_dropdown() if not self.dropdown_visible else None)
        root.protocol("WM_DELETE_WINDOW", handle_cancel)

        # Initial focus
        entry_field.focus_set()

        try:
            root.mainloop()
        finally:
            if not self._is_closing:
                _cleanup_and_close()


if __name__ == "__main__":
    def on_done(cid):
        print(f"Active claim context confirmed: {cid}")

    dialog = ClaimDialog(on_submit=on_done, running_claims=[
        ("CLM-001", "Shift Claim", "IN_PROGRESS"),
        ("CLM-002", "Shift Claim", "COMPLETED")
    ])
    dialog.show(current_claim="CLM-001", platform_name="NovaArc RCM")
