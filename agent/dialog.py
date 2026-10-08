import re
import threading
import tkinter as tk
from tkinter import messagebox
from typing import Optional, Callable, List, Tuple, Any
import requests


DEFAULT_RUNNING_CLAIMS: List[Tuple[str, str, str]] = []


class ClaimDialog:
    """
    System-wide Executive Floating Dialogue Box (Claim Work Assistant).
    Adheres to UI/UX Pro Design System:
    - Obsidian Header with Cobalt Accents
    - Integrated In-Window Accessible Combobox with Zero-Glitch Dropdown
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

    def show(
        self,
        current_claim: Optional[str] = None,
        platform_name: str = "NovaArc RCM",
    ):
        root = tk.Tk()
        root.title(f"Claim Work Assistant — {platform_name}")

        # Dimension specifications
        base_w = 520
        h_collapsed = 310
        h_expanded = 490

        screen_w = root.winfo_screenwidth()
        screen_h = root.winfo_screenheight()
        pos_x = max(0, (screen_w - base_w) // 2)
        pos_y = max(0, (screen_h - h_expanded) // 2)

        root.geometry(f"{base_w}x{h_collapsed}+{pos_x}+{pos_y}")
        root.resizable(False, False)

        # Enforce System-wide Always-On-Top natively once (no focus-stealing loops)
        root.attributes("-topmost", True)
        root.lift()
        root.focus_force()

        # Win32 HWND_TOPMOST reinforcement
        try:
            import ctypes
            u32 = ctypes.windll.user32
            root.update_idletasks()
            hwnd = root.winfo_id()
            u32.SetWindowPos(hwnd, -1, 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0040)
            u32.SetForegroundWindow(hwnd)
        except Exception:
            pass

        # Executive UI/UX Pro Canvas
        root.configure(bg="#ffffff")

        # --- Executive Header Bar ---
        header_frame = tk.Frame(root, bg="#0f172a", height=50)
        header_frame.pack(fill="x", side="top")
        header_frame.pack_propagate(False)

        # Left Icon Badge
        icon_box = tk.Frame(header_frame, bg="#2563eb", width=28, height=28)
        icon_box.pack(side="left", padx=(16, 10), pady=11)
        icon_box.pack_propagate(False)
        icon_lbl = tk.Label(
            icon_box,
            text="[+]",
            font=("Consolas", 10, "bold"),
            fg="#ffffff",
            bg="#2563eb"
        )
        icon_lbl.pack(expand=True)

        # Title
        title_lbl = tk.Label(
            header_frame,
            text="Claim Work Assistant",
            font=("Segoe UI", 11, "bold"),
            fg="#ffffff",
            bg="#0f172a"
        )
        title_lbl.pack(side="left", pady=13)

        # Right Platform Badge with Pulse Dot
        right_badge_frame = tk.Frame(header_frame, bg="#1e293b", padx=8, pady=3)
        right_badge_frame.pack(side="right", padx=16, pady=11)

        pulse_dot = tk.Label(
            right_badge_frame,
            text="●",
            font=("Segoe UI", 7),
            fg="#10b981",
            bg="#1e293b"
        )
        pulse_dot.pack(side="left", padx=(0, 4))

        platform_badge = tk.Label(
            right_badge_frame,
            text=platform_name,
            font=("Segoe UI", 8, "bold"),
            fg="#93c5fd",
            bg="#1e293b"
        )
        platform_badge.pack(side="left")

        # --- Main Body Container ---
        body_frame = tk.Frame(root, bg="#ffffff", padx=22, pady=14)
        body_frame.pack(fill="both", expand=True)

        prompt_lbl = tk.Label(
            body_frame,
            text=f"A claim platform is open ({platform_name}).\nWhich claim do you want to work on?",
            font=("Segoe UI", 9, "bold"),
            fg="#0f172a",
            bg="#ffffff",
            justify="left"
        )
        prompt_lbl.pack(anchor="w", pady=(0, 10))

        # --- Single Unified Combobox Field (Input + Integrated Dropdown) ---
        dd_label = tk.Label(
            body_frame,
            text="CLAIM ID (TYPE NEW OR CHOOSE FROM DROPDOWN):",
            font=("Segoe UI", 8, "bold"),
            fg="#475569",
            bg="#ffffff"
        )
        dd_label.pack(anchor="w", pady=(0, 5))

        # Initial Claim value
        initial_val = current_claim if current_claim and current_claim != "UNASSIGNED" else ""
        entry_var = tk.StringVar(value=initial_val)

        # Input Row Frame (Simulates unified executive combobox with arrow button)
        input_container = tk.Frame(body_frame, bg="#ffffff", highlightthickness=2, highlightbackground="#cbd5e1", highlightcolor="#2563eb")
        input_container.pack(fill="x", pady=(0, 4))

        entry_field = tk.Entry(
            input_container,
            textvariable=entry_var,
            font=("Consolas", 11, "bold"),
            bg="#ffffff",
            fg="#0f172a",
            relief="flat",
            bd=0
        )
        entry_field.pack(side="left", fill="x", expand=True, padx=(10, 4), ipady=7)

        # Dropdown Toggle Button (▾)
        toggle_btn = tk.Button(
            input_container,
            text=" ▾ Select Existing ",
            font=("Segoe UI", 8, "bold"),
            bg="#f1f5f9",
            fg="#1e293b",
            activebackground="#e2e8f0",
            activeforeground="#0f172a",
            relief="flat",
            bd=0,
            padx=10,
            cursor="hand2"
        )
        toggle_btn.pack(side="right", fill="y", padx=2, pady=2)

        hint_lbl = tk.Label(
            body_frame,
            text="Type any Claim ID directly into the box, or click the dropdown arrow to pick an existing claim.",
            font=("Segoe UI", 7),
            fg="#64748b",
            bg="#ffffff"
        )
        hint_lbl.pack(anchor="w", pady=(0, 10))

        # --- Dropdown Menu Panel (In-Window for 100% Stability & Zero-Glitch) ---
        dropdown_frame = tk.Frame(body_frame, bg="#ffffff", bd=1, relief="solid", highlightthickness=1, highlightbackground="#94a3b8")

        # Scrollable Canvas for Claims List
        canvas = tk.Canvas(dropdown_frame, bg="#ffffff", highlightthickness=0, height=170)
        scrollbar = tk.Scrollbar(dropdown_frame, orient="vertical", command=canvas.yview)
        scrollable_frame = tk.Frame(canvas, bg="#ffffff")

        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )
        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw", width=460)
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
                    text="No matching claims found. You can type a new one directly.",
                    font=("Segoe UI", 8),
                    fg="#64748b",
                    bg="#ffffff",
                    pady=10
                )
                no_res.pack(fill="x")
                return

            for item in filtered_claims:
                cid = item[0]
                pname = item[1]
                curr_status = item[2] if len(item) > 2 else "IN_PROGRESS"

                row = tk.Frame(scrollable_frame, bg="#ffffff", padx=8, pady=5)
                row.pack(fill="x")

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

                pat_lbl = tk.Label(
                    info_frame,
                    text=f" — {pname}",
                    font=("Segoe UI", 8),
                    fg="#475569",
                    bg="#ffffff",
                    cursor="hand2"
                )
                pat_lbl.pack(side="left", padx=(4, 0))

                # Right side: Interactive Actions (Status toggle + Close button)
                actions_frame = tk.Frame(row, bg="#ffffff")
                actions_frame.pack(side="right")

                # Helper to get badge colors
                def _get_status_style(st_val: str):
                    if "COMPLETED" in st_val.upper():
                        return "#15803d", "#dcfce7", "#bbf7d0", " COMPLETED "
                    return "#b45309", "#fef3c7", "#fde68a", " IN_PROGRESS "

                s_fg, s_bg, s_abg, s_txt = _get_status_style(curr_status)

                status_btn = tk.Button(
                    actions_frame,
                    text=s_txt,
                    font=("Segoe UI", 7, "bold"),
                    fg=s_fg,
                    bg=s_bg,
                    activeforeground=s_fg,
                    activebackground=s_abg,
                    relief="flat",
                    bd=0,
                    padx=6,
                    pady=2,
                    cursor="hand2"
                )
                status_btn.pack(side="left", padx=(0, 6))

                # Interactive Status Toggle Handler
                def _toggle_status(c_id=cid, target_item=item, s_btn=status_btn):
                    old_st = target_item[2] if len(target_item) > 2 else "IN_PROGRESS"
                    new_st = "IN_PROGRESS" if "COMPLETED" in old_st.upper() else "COMPLETED"
                    target_item[2] = new_st

                    # Also update internal self.running_claims
                    for rc in self.running_claims:
                        if rc[0] == c_id:
                            rc[2] = new_st
                            break

                    n_fg, n_bg, n_abg, n_txt = _get_status_style(new_st)
                    s_btn.configure(text=n_txt, fg=n_fg, bg=n_bg, activeforeground=n_fg, activebackground=n_abg)

                    # Trigger status change callback if provided
                    if self.on_status_change:
                        try:
                            self.on_status_change(c_id, new_st)
                        except Exception:
                            pass

                    # Notify backend asynchronously
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

                # Close Button (Disappears claim from dropdown, completes in DB/Dashboard, updates Excel)
                close_btn = tk.Button(
                    actions_frame,
                    text="Close",
                    font=("Segoe UI", 7, "bold"),
                    fg="#dc2626",
                    bg="#fee2e2",
                    activeforeground="#b91c1c",
                    activebackground="#fecaca",
                    relief="solid",
                    bd=1,
                    padx=6,
                    pady=1,
                    cursor="hand2"
                )
                close_btn.pack(side="left")

                def _close_claim(c_id=cid, r_frame=row):
                    # 1. Remove from self.running_claims
                    self.running_claims = [rc for rc in self.running_claims if rc[0] != c_id]

                    # 2. Destroy row immediately so it disappears from dropdown
                    r_frame.destroy()

                    # 3. If currently typed in entry, clear it
                    if entry_var.get().strip().upper() == c_id.upper():
                        entry_var.set("")

                    # 4. If empty, show empty state message
                    if not self.running_claims or len(scrollable_frame.winfo_children()) == 0:
                        empty_lbl = tk.Label(
                            scrollable_frame,
                            text="All claims closed! Type a new Claim ID in the box above.",
                            font=("Segoe UI", 8),
                            fg="#15803d",
                            bg="#ffffff",
                            pady=12
                        )
                        empty_lbl.pack(fill="x")

                    # 5. Invoke on_close_claim callback
                    if self.on_close_claim:
                        try:
                            self.on_close_claim(c_id, "COMPLETED")
                        except Exception:
                            pass

                    # 6. Notify backend asynchronously to complete claim & export Excel
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

                # Selection Handler when clicking claim text or row
                def _select_claim(selected_cid=cid):
                    entry_var.set(selected_cid)
                    toggle_dropdown(force_close=True)
                    entry_field.focus_set()

                # Hover highlight
                def _on_enter(e, r=row, c1=cid_lbl, c2=pat_lbl, inf=info_frame):
                    r.configure(bg="#eff6ff")
                    c1.configure(bg="#eff6ff")
                    c2.configure(bg="#eff6ff")
                    inf.configure(bg="#eff6ff")

                def _on_leave(e, r=row, c1=cid_lbl, c2=pat_lbl, inf=info_frame):
                    r.configure(bg="#ffffff")
                    c1.configure(bg="#ffffff")
                    c2.configure(bg="#ffffff")
                    inf.configure(bg="#ffffff")

                for w in (info_frame, cid_lbl, pat_lbl):
                    w.bind("<Button-1>", lambda e, scid=cid: _select_claim(scid))
                    w.bind("<Enter>", _on_enter)
                    w.bind("<Leave>", _on_leave)

        def toggle_dropdown(force_close=False):
            if self.dropdown_visible or force_close:
                dropdown_frame.pack_forget()
                root.geometry(f"{base_w}x{h_collapsed}")
                toggle_btn.configure(text=" ▾ Select Existing ", bg="#f1f5f9")
                self.dropdown_visible = False
            else:
                populate_dropdown_list(entry_var.get())
                dropdown_frame.pack(fill="x", pady=(0, 10), before=btn_frame)
                root.geometry(f"{base_w}x{h_expanded}")
                toggle_btn.configure(text=" ▴ Close List ", bg="#e2e8f0")
                self.dropdown_visible = True

        toggle_btn.configure(command=toggle_dropdown)

        # Real-time search/filter as user types
        def on_entry_change(*args):
            if self.dropdown_visible:
                populate_dropdown_list(entry_var.get())

        entry_var.trace_add("write", on_entry_change)

        # --- Action Buttons Bar ---
        btn_frame = tk.Frame(body_frame, bg="#ffffff")
        btn_frame.pack(fill="x", side="bottom", pady=(10, 0))

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

            if self.on_submit:
                self.on_submit(final_claim)
            root.destroy()

        def handle_cancel():
            if self.on_cancel:
                self.on_cancel()
            root.destroy()

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
            padx=16,
            pady=6,
            cursor="hand2"
        )
        cancel_btn.pack(side="left")

        submit_btn = tk.Button(
            btn_frame,
            text="Continue  ➔",
            command=handle_confirm,
            bg="#0f172a",
            fg="#ffffff",
            activebackground="#1e293b",
            activeforeground="#ffffff",
            relief="flat",
            bd=0,
            font=("Segoe UI", 9, "bold"),
            padx=24,
            pady=7,
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

        root.mainloop()


if __name__ == "__main__":
    def on_done(cid):
        print(f"Active claim context confirmed: {cid}")

    dialog = ClaimDialog(on_submit=on_done)
    dialog.show(current_claim="CLM1003", platform_name="NovaArc RCM")
