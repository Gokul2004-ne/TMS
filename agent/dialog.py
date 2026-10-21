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


DEFAULT_RUNNING_CLAIMS: List[Tuple[str, str, str]] = []


class ClaimDialog:
    """
    System-wide Executive Floating Dialogue Box (Claim Work Assistant).
    Adheres to UI/UX Pro Design System:
    - Obsidian Header with Cobalt Accents & Emerald Pulse Indicator
    - Integrated In-Window Accessible Combobox with Zero-Glitch Dropdown
    - Dynamic Status Conversion: Close button appears ONLY when status is COMPLETED
    - Keyboard Accessible (Up/Down, Enter, Esc)
    - Always-on-Top without focus-stealing loops
    """

    def __init__(
        self,
        on_submit: Optional[Callable[[str], None]] = None,
        on_cancel: Optional[Callable[[], None]] = None,
        on_close_claim: Optional[Callable[[str, str], None]] = None,
        on_status_change: Optional[Callable[[str, str], None]] = None,
        running_claims: Optional[List[Any]] = None,
        associate_id: str = "EMP101",
    ):
        self.on_submit = on_submit
        self.on_cancel = on_cancel
        self.on_close_claim = on_close_claim
        self.on_status_change = on_status_change
        self.associate_id = associate_id
        # Normalize running claims to mutable list of [cid, desc, status]
        raw_list = running_claims if running_claims is not None else DEFAULT_RUNNING_CLAIMS
        self.running_claims = [[item[0], item[1], item[2]] for item in raw_list]
        self.claim_regex = re.compile(r"CLM\d{4,8}", re.IGNORECASE)
        self.dropdown_visible = False

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
        root.title(f"Claim Work Assistant — {platform_name}")

        # Dimension specifications (accommodates top-left last worked badge and big buttons)
        base_w = 580
        h_collapsed = 425
        h_expanded = 640

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
                            # If application window is compact/small, fit dialog width inside it
                            if app_w < 580:
                                base_w = max(400, app_w - 24)
                            else:
                                base_w = 580

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

                            # Strictly discard ALL mouse button & wheel events OUTSIDE the dialog
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

        # Title & Subtitle Container (Clean, readable, not clipped)
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

        # Right Platform Badge (Clean platform indicator)
        clean_platform = "NovaArc RCM" if ("NovaArc" in platform_name or not platform_name) else platform_name
        if len(clean_platform) > 22:
            clean_platform = clean_platform[:19] + "..."

        right_badge_frame = tk.Frame(header_frame, bg="#1e293b", padx=10, pady=4, relief="solid", bd=1, highlightthickness=0)
        right_badge_frame.pack(side="right")

        pulse_dot = tk.Label(
            right_badge_frame,
            text="●",
            font=("Segoe UI", 7),
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

        # --- Main Body Container ---
        body_frame = tk.Frame(root, bg="#ffffff", padx=22, pady=14)
        body_frame.pack(fill="both", expand=True)

        # Info Prompt Box (Light Green tint, clean human text)
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
            text="Enter a Claim ID or select an existing claim from the list below.",
            font=("Segoe UI", 8),
            fg="#166534",
            bg="#f0fdf4",
            anchor="w"
        )
        prompt_sub.pack(fill="x", pady=(2, 0))

        # --- Single Unified Combobox Field (Input + Integrated Dropdown) ---
        dd_label = tk.Label(
            body_frame,
            text="Claim ID",
            font=("Segoe UI", 9, "bold"),
            fg="#334155",
            bg="#ffffff"
        )
        dd_label.pack(anchor="w", pady=(0, 5))

        # Initial Claim value
        initial_val = current_claim if current_claim and current_claim != "UNASSIGNED" else ""
        entry_var = tk.StringVar(value=initial_val)

        # Input Row Frame
        input_container = tk.Frame(body_frame, bg="#ffffff", highlightthickness=2, highlightbackground="#cbd5e1", highlightcolor="#16a34a")
        input_container.pack(fill="x", pady=(0, 4))

        entry_field = tk.Entry(
            input_container,
            textvariable=entry_var,
            font=("Consolas", 12, "bold"),
            bg="#ffffff",
            fg="#0f172a",
            relief="flat",
            bd=0
        )
        entry_field.pack(side="left", fill="x", expand=True, padx=(12, 6), ipady=10)

        # Dropdown Toggle Button (Clean text, no special characters, bigger size)
        toggle_btn = tk.Button(
            input_container,
            text="Select Existing",
            font=("Segoe UI", 9, "bold"),
            bg="#f0fdf4",
            fg="#15803d",
            activebackground="#dcfce7",
            activeforeground="#14532d",
            relief="flat",
            bd=0,
            padx=16,
            pady=4,
            cursor="hand2"
        )
        toggle_btn.pack(side="right", fill="y", padx=3, pady=3)

        hint_lbl = tk.Label(
            body_frame,
            text="Tip: When a claim is completed, mark it as Completed to close it.",
            font=("Segoe UI", 8),
            fg="#64748b",
            bg="#ffffff"
        )
        hint_lbl.pack(anchor="w", pady=(0, 8))

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
            toast_lbl.configure(text=f"✓ {msg}")
            toast_frame.pack(fill="x", pady=(0, 6), before=input_container)
            root.after(3500, lambda: toast_frame.pack_forget())

        # --- Dropdown Menu Panel (In-Window for 100% Stability & Zero-Glitch) ---
        dropdown_frame = tk.Frame(body_frame, bg="#ffffff", bd=1, relief="solid", highlightthickness=1, highlightbackground="#94a3b8")

        # Scrollable Canvas for Claims List
        canvas = tk.Canvas(dropdown_frame, bg="#f8fafc", highlightthickness=0, height=170)
        scrollbar = tk.Scrollbar(dropdown_frame, orient="vertical", command=canvas.yview)
        scrollable_frame = tk.Frame(canvas, bg="#f8fafc")

        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )
        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw", width=max(320, base_w - 60))
        canvas.configure(yscrollcommand=scrollbar.set)

        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        def populate_dropdown_list(filter_text=""):
            for widget in scrollable_frame.winfo_children():
                widget.destroy()

            filt = filter_text.strip().upper()
            filtered_claims = [
                c for c in self.running_claims
                if not filt or filt in c[0].upper() or filt in c[1].upper() or filt in c[2].upper()
            ]

            if not filtered_claims:
                no_res = tk.Label(
                    scrollable_frame,
                    text="No matching claims found. You can type a new one directly above.",
                    font=("Segoe UI", 8),
                    fg="#64748b",
                    bg="#f8fafc",
                    pady=16
                )
                no_res.pack(fill="x")
                return

            for item in filtered_claims:
                cid = item[0]
                pname = item[1]
                curr_status = item[2] if len(item) > 2 else "IN_PROGRESS"

                row = tk.Frame(scrollable_frame, bg="#ffffff", padx=10, pady=7, highlightthickness=1, highlightbackground="#e2e8f0")
                row.pack(fill="x", padx=4, pady=3)

                # Left side: Claim Info
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

                label_text = f" ({pname})" if pname and pname != "Shift Claim" else ""
                pat_lbl = tk.Label(
                    info_frame,
                    text=label_text,
                    font=("Segoe UI", 8),
                    fg="#64748b",
                    bg="#ffffff",
                    cursor="hand2"
                )
                if label_text:
                    pat_lbl.pack(side="left", padx=(4, 0))

                # Right side: Interactive Actions Container
                actions_frame = tk.Frame(row, bg="#ffffff")
                actions_frame.pack(side="right")

                # Helper to format status pill
                def _get_status_style(st_val: str):
                    if "COMPLETED" in st_val.upper():
                        return "#15803d", "#dcfce7", "#86efac", "COMPLETED"
                    return "#b45309", "#fef3c7", "#fde68a", "IN PROGRESS"

                s_fg, s_bg, s_border, s_txt = _get_status_style(curr_status)

                status_btn = tk.Button(
                    actions_frame,
                    text=s_txt,
                    font=("Segoe UI", 9, "bold"),
                    fg=s_fg,
                    bg=s_bg,
                    activeforeground=s_fg,
                    activebackground=s_bg,
                    relief="solid",
                    bd=1,
                    highlightbackground=s_border,
                    padx=12,
                    pady=4,
                    cursor="hand2"
                )
                status_btn.pack(side="left")

                # Close Button — ONLY APPEARS WHEN STATUS IS COMPLETED
                close_btn = tk.Button(
                    actions_frame,
                    text="Close",
                    font=("Segoe UI", 9, "bold"),
                    fg="#b91c1c",
                    bg="#fee2e2",
                    activeforeground="#7f1d1d",
                    activebackground="#fecaca",
                    relief="solid",
                    bd=1,
                    padx=12,
                    pady=4,
                    cursor="hand2"
                )

                # Dynamic Visibility on initial render:
                if "COMPLETED" in curr_status.upper():
                    close_btn.pack(side="left", padx=(6, 0))
                else:
                    close_btn.pack_forget()

                # Status Toggle Handler
                def _toggle_status(c_id=cid, target_item=item, s_btn=status_btn, c_btn=close_btn):
                    old_st = target_item[2] if len(target_item) > 2 else "IN_PROGRESS"
                    new_st = "IN_PROGRESS" if "COMPLETED" in old_st.upper() else "COMPLETED"
                    target_item[2] = new_st

                    # Sync internal list
                    for rc in self.running_claims:
                        if rc[0] == c_id:
                            rc[2] = new_st
                            break

                    n_fg, n_bg, n_border, n_txt = _get_status_style(new_st)
                    s_btn.configure(text=n_txt, fg=n_fg, bg=n_bg, activeforeground=n_fg, activebackground=n_bg, highlightbackground=n_border)

                    # Close button appears ONLY when status is COMPLETED
                    if "COMPLETED" in new_st.upper():
                        c_btn.pack(side="left", padx=(6, 0))
                    else:
                        c_btn.pack_forget()

                    if self.on_status_change:
                        try:
                            self.on_status_change(c_id, new_st)
                        except Exception:
                            pass

                    # Backend sync
                    def _notify():
                        try:
                            requests.post(
                                f"http://localhost:8000/api/associate/{self.associate_id}/claims/{c_id}/status",
                                json={"status": new_st},
                                timeout=2.0
                            )
                        except Exception:
                            pass
                    threading.Thread(target=_notify, daemon=True).start()

                status_btn.configure(command=_toggle_status)

                # Close Button Handler
                def _close_claim(c_id=cid, r_frame=row):
                    self.running_claims = [rc for rc in self.running_claims if rc[0] != c_id]
                    r_frame.destroy()

                    if entry_var.get().strip().upper() == c_id.upper():
                        entry_var.set("")

                    show_toast(f"Claim {c_id} closed, marked COMPLETED, and saved to Excel.")

                    if not self.running_claims or len(scrollable_frame.winfo_children()) == 0:
                        empty_lbl = tk.Label(
                            scrollable_frame,
                            text="All claims closed! Type a new Claim ID above.",
                            font=("Segoe UI", 8, "bold"),
                            fg="#15803d",
                            bg="#f8fafc",
                            pady=14
                        )
                        empty_lbl.pack(fill="x")

                    if self.on_close_claim:
                        try:
                            self.on_close_claim(c_id, "COMPLETED")
                        except Exception:
                            pass

                    def _call_complete_api():
                        try:
                            requests.post(
                                f"http://localhost:8000/api/associate/{self.associate_id}/claims/{c_id}/complete",
                                json={"status": "COMPLETED", "export_excel": True},
                                timeout=3.0
                            )
                        except Exception as ex:
                            print(f"[Dialog] Error notifying claim completion: {ex}")

                    threading.Thread(target=_call_complete_api, daemon=True).start()

                close_btn.configure(command=_close_claim)

                # Selection Handler when clicking claim info
                def _select_claim(selected_cid=cid):
                    entry_var.set(selected_cid)
                    toggle_dropdown(force_close=True)
                    entry_field.focus_set()

                # Hover highlight (light green)
                def _on_enter(e, r=row, c1=cid_lbl, c2=pat_lbl, inf=info_frame):
                    r.configure(bg="#f0fdf4", highlightbackground="#86efac")
                    c1.configure(bg="#f0fdf4", fg="#15803d")
                    c2.configure(bg="#f0fdf4")
                    inf.configure(bg="#f0fdf4")

                def _on_leave(e, r=row, c1=cid_lbl, c2=pat_lbl, inf=info_frame):
                    r.configure(bg="#ffffff", highlightbackground="#e2e8f0")
                    c1.configure(bg="#ffffff", fg="#0f172a")
                    c2.configure(bg="#ffffff")
                    inf.configure(bg="#ffffff")

                for w in (info_frame, cid_lbl, pat_lbl):
                    w.bind("<Button-1>", lambda e, scid=cid: _select_claim(scid))
                    w.bind("<Enter>", _on_enter)
                    w.bind("<Leave>", _on_leave)

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

        # Real-time search/filter as user types
        def on_entry_change(*args):
            if self.dropdown_visible:
                populate_dropdown_list(entry_var.get())

        entry_var.trace_add("write", on_entry_change)

        # --- Action Buttons Bar ---
        btn_frame = tk.Frame(body_frame, bg="#ffffff")
        btn_frame.pack(fill="x", side="bottom", pady=(14, 0))

        def _cleanup_and_close():
            if self._is_closing:
                return
            self._is_closing = True

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
                    u32.ShowWindow(self._taskbar_hwnd, 5)  # SW_SHOW
                if self._sec_taskbar_hwnd and u32.IsWindow(self._sec_taskbar_hwnd):
                    u32.ShowWindow(self._sec_taskbar_hwnd, 5)  # SW_SHOW
            except Exception as e:
                print(f"[Dialog] Taskbar restore notice: {e}")
            finally:
                self._taskbar_hwnd = None
                self._sec_taskbar_hwnd = None

            # 3. Restore input and foreground focus directly to target application (e.g. Chrome)
            if target_hwnd:
                try:
                    import ctypes
                    u32 = ctypes.windll.user32
                    if u32.IsWindow(target_hwnd):
                        u32.ShowWindow(target_hwnd, 9)  # SW_RESTORE
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
            raw_val = entry_var.get().strip()
            if not raw_val:
                messagebox.showwarning(
                    "Claim Required", "Please enter or select a valid Claim ID."
                )
                return

            match = self.claim_regex.search(raw_val)
            if match:
                final_claim = match.group(0).upper()
            elif "—" in raw_val:
                final_claim = raw_val.split("—")[0].strip().upper()
            else:
                final_claim = raw_val.upper()

            if not final_claim:
                messagebox.showwarning(
                    "Claim Required", "Please enter or select a valid Claim ID."
                )
                return

            _cleanup_and_close()
            if self.on_submit:
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
            font=("Segoe UI", 11, "bold"),
            padx=32,
            pady=11,
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
            font=("Segoe UI", 12, "bold"),
            padx=42,
            pady=11,
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
