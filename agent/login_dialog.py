"""
Workstation Employee Login & Single-PC Lock Verification Dialog.
Runs on desktop agent startup when no verified Employee ID is assigned for this PC
or when the saved Employee ID is currently locked/active on another workstation.
"""

import threading
import tkinter as tk
from typing import Callable, Optional, Tuple


QUICK_PRESETS = ["EMP101", "EMP102", "EMP103", "EMP104"]


def prompt_workstation_login(
    device_id: str,
    check_lock_fn: Callable[[str], Tuple[bool, str]],
    default_id: str = "",
    initial_error: str = "",
    backend_label: str = "frccind.com",
) -> Tuple[Optional[str], bool]:
    """
    Shows a crisp modal login window on desktop agent launch.

    Returns:
        (associate_id, remember_on_pc) or (None, False) if cancelled/closed.
    """
    selected_result: dict = {"associate_id": None, "remember": True}

    root = tk.Tk()
    root.title("NovaArc TMS · Workstation Login")
    root.configure(bg="#f8fafc")
    root.withdraw()

    win_w = 520
    win_h = 460
    scr_w = root.winfo_screenwidth()
    scr_h = root.winfo_screenheight()
    pos_x = max(20, (scr_w - win_w) // 2)
    pos_y = max(20, (scr_h - win_h) // 2)
    root.geometry(f"{win_w}x{win_h}+{pos_x}+{pos_y}")
    root.resizable(False, False)
    root.attributes("-topmost", True)

    # Top accent bar
    tk.Frame(root, bg="#7c3aed", height=4).pack(fill="x", side="top")

    # Dark executive header
    header = tk.Frame(root, bg="#090d16", padx=20, pady=14)
    header.pack(fill="x", side="top")

    icon_box = tk.Frame(header, bg="#7c3aed", width=34, height=34)
    icon_box.pack(side="left", padx=(0, 12))
    icon_box.pack_propagate(False)
    tk.Label(icon_box, text="TMS", font=("Segoe UI", 9, "bold"), fg="#ffffff", bg="#7c3aed").pack(expand=True)

    title_col = tk.Frame(header, bg="#090d16")
    title_col.pack(side="left", fill="x", expand=True)
    tk.Label(
        title_col,
        text="Workstation Sign In",
        font=("Segoe UI", 12, "bold"),
        fg="#f8fafc",
        bg="#090d16",
    ).pack(anchor="w")
    tk.Label(
        title_col,
        text=f"PC ID: DEV-{device_id.upper()}  |  Cloud DB: {backend_label}",
        font=("Consolas", 8, "bold"),
        fg="#a7f3d0",
        bg="#090d16",
    ).pack(anchor="w", pady=(2, 0))

    # Body container
    body = tk.Frame(root, bg="#ffffff", padx=22, pady=16)
    body.pack(fill="both", expand=True)

    # Info banner
    info_box = tk.Frame(body, bg="#f5f3ff", padx=12, pady=9, highlightthickness=1, highlightbackground="#ddd6fe")
    info_box.pack(fill="x", pady=(0, 14))
    tk.Label(
        info_box,
        text="Single-PC Employee Login Lock Enabled",
        font=("Segoe UI", 9, "bold"),
        fg="#4c1d95",
        bg="#f5f3ff",
        anchor="w",
    ).pack(fill="x")
    tk.Label(
        info_box,
        text="Each Employee ID can track from only one workstation at a time. Signing in launches your TMS portal and locks tracking to this PC.",
        font=("Segoe UI", 8),
        fg="#6d28d9",
        bg="#f5f3ff",
        anchor="w",
        wraplength=450,
        justify="left",
    ).pack(fill="x", pady=(2, 0))

    # Quick select presets
    tk.Label(
        body,
        text="QUICK SELECT EMPLOYEE ID",
        font=("Segoe UI", 7, "bold"),
        fg="#64748b",
        bg="#ffffff",
    ).pack(anchor="w", pady=(0, 6))

    clean_default = "" if (not default_id or default_id.strip().upper() == "AUTO") else default_id.strip().upper()
    id_var = tk.StringVar(value=clean_default)
    remember_var = tk.BooleanVar(value=True)
    is_checking = {"val": False}

    chips_frame = tk.Frame(body, bg="#ffffff")
    chips_frame.pack(fill="x", pady=(0, 12))

    def select_chip(pid: str):
        id_var.set(pid)
        entry.icursor("end")
        set_status("neutral", f"Ready to verify workstation lock for {pid} on DEV-{device_id.upper()}.")

    for pid in QUICK_PRESETS:
        btn = tk.Button(
            chips_frame,
            text=pid,
            font=("Consolas", 9, "bold"),
            fg="#312e81",
            bg="#eef2ff",
            activebackground="#c7d2fe",
            activeforeground="#1e1b4b",
            relief="solid",
            bd=1,
            padx=12,
            pady=4,
            cursor="hand2",
            command=lambda p=pid: select_chip(p),
        )
        btn.pack(side="left", padx=(0, 8))

    tk.Label(
        body,
        text="Employee ID (or Custom EMP-...)",
        font=("Segoe UI", 9, "bold"),
        fg="#1e293b",
        bg="#ffffff",
    ).pack(anchor="w", pady=(0, 4))

    entry_frame = tk.Frame(body, bg="#ffffff", highlightthickness=2, highlightbackground="#c4b5fd", highlightcolor="#7c3aed")
    entry_frame.pack(fill="x", pady=(0, 10))

    entry = tk.Entry(
        entry_frame,
        textvariable=id_var,
        font=("Consolas", 12, "bold"),
        fg="#18171c",
        bg="#ffffff",
        relief="flat",
        bd=0,
    )
    entry.pack(fill="x", padx=10, ipady=6)

    def _upper_trace(*_):
        val = id_var.get()
        up = val.upper()
        if val != up:
            pos = entry.index("insert")
            id_var.set(up)
            entry.icursor(pos)

    id_var.trace_add("write", _upper_trace)

    tk.Checkbutton(
        body,
        text="Remember this Employee ID on this workstation",
        variable=remember_var,
        font=("Segoe UI", 8),
        fg="#475569",
        bg="#ffffff",
        activebackground="#ffffff",
        selectcolor="#ffffff",
        cursor="hand2",
    ).pack(anchor="w", pady=(0, 10))

    # Status / conflict feedback box
    status_box = tk.Frame(body, bg="#f8fafc", padx=12, pady=8, highlightthickness=1, highlightbackground="#cbd5e1")
    status_box.pack(fill="x", pady=(0, 12))

    status_lbl = tk.Label(
        status_box,
        text=initial_error or f"Enter your Employee ID to sign in and connect DEV-{device_id.upper()} to Live Cloud DB.",
        font=("Segoe UI", 8, "bold" if initial_error else "normal"),
        fg="#b91c1c" if initial_error else "#475569",
        bg="#f8fafc",
        wraplength=445,
        justify="left",
        anchor="w",
    )
    status_lbl.pack(fill="x")

    if initial_error:
        status_box.configure(bg="#fef2f2", highlightbackground="#fca5a5")
        status_lbl.configure(bg="#fef2f2")

    def set_status(kind: str, msg: str):
        if kind == "error":
            status_box.configure(bg="#fef2f2", highlightbackground="#fca5a5")
            status_lbl.configure(bg="#fef2f2", fg="#b91c1c", font=("Segoe UI", 8, "bold"), text=msg)
            entry_frame.configure(highlightbackground="#ef4444", highlightcolor="#ef4444")
        elif kind == "ok":
            status_box.configure(bg="#ecfdf5", highlightbackground="#6ee7b7")
            status_lbl.configure(bg="#ecfdf5", fg="#065f46", font=("Segoe UI", 8, "bold"), text=msg)
            entry_frame.configure(highlightbackground="#10b981", highlightcolor="#10b981")
        elif kind == "busy":
            status_box.configure(bg="#eff6ff", highlightbackground="#93c5fd")
            status_lbl.configure(bg="#eff6ff", fg="#1e40af", font=("Segoe UI", 8, "bold"), text=msg)
            entry_frame.configure(highlightbackground="#3b82f6", highlightcolor="#3b82f6")
        else:
            status_box.configure(bg="#f8fafc", highlightbackground="#cbd5e1")
            status_lbl.configure(bg="#f8fafc", fg="#475569", font=("Segoe UI", 8), text=msg)
            entry_frame.configure(highlightbackground="#c4b5fd", highlightcolor="#7c3aed")

    btn_row = tk.Frame(body, bg="#ffffff")
    btn_row.pack(fill="x", side="bottom")

    def handle_cancel():
        if is_checking["val"]:
            return
        selected_result["associate_id"] = None
        root.destroy()

    def handle_submit():
        if is_checking["val"]:
            return
        cand = id_var.get().strip().upper()
        if not cand or cand in ("AUTO", "UNASSIGNED", "UNKNOWN"):
            set_status("error", "Please enter a valid Employee ID (for example: EMP101 or EMP102).")
            entry.focus_set()
            return
        if len(cand) < 3 or len(cand) > 30:
            set_status("error", "Employee ID must be between 3 and 30 characters.")
            entry.focus_set()
            return

        is_checking["val"] = True
        submit_btn.configure(state="disabled", text="Verifying Lock...")
        set_status("busy", f"Checking live workstation lock for {cand} across Live Cloud DB...")

        def _worker():
            try:
                allowed, reason = check_lock_fn(cand)
            except Exception as e:
                allowed, reason = True, f"Offline fallback notice: {e}"

            def _on_done():
                if not root.winfo_exists():
                    return
                is_checking["val"] = False
                submit_btn.configure(state="normal", text="Sign In & Open TMS")
                if allowed:
                    selected_result["associate_id"] = cand
                    selected_result["remember"] = bool(remember_var.get())
                    set_status("ok", f"Verified {cand} on DEV-{device_id.upper()}. Launching TMS Dashboard...")
                    root.after(180, root.destroy)
                else:
                    set_status("error", reason or f"{cand} is already logged in on another workstation.")
                    entry.focus_set()

            root.after(0, _on_done)

        threading.Thread(target=_worker, daemon=True).start()

    cancel_btn = tk.Button(
        btn_row,
        text="Exit",
        command=handle_cancel,
        bg="#f1f5f9",
        fg="#334155",
        activebackground="#e2e8f0",
        relief="solid",
        bd=1,
        font=("Segoe UI", 9, "bold"),
        padx=22,
        pady=7,
        cursor="hand2",
    )
    cancel_btn.pack(side="left")

    submit_btn = tk.Button(
        btn_row,
        text="Sign In & Open TMS",
        command=handle_submit,
        bg="#7c3aed",
        fg="#ffffff",
        activebackground="#6d28d9",
        activeforeground="#ffffff",
        relief="flat",
        bd=0,
        font=("Segoe UI", 9, "bold"),
        padx=24,
        pady=8,
        cursor="hand2",
    )
    submit_btn.pack(side="right")

    root.bind("<Return>", lambda e: handle_submit())
    root.bind("<Escape>", lambda e: handle_cancel())
    root.protocol("WM_DELETE_WINDOW", handle_cancel)

    entry.focus_set()
    root.deiconify()
    root.lift()
    root.mainloop()

    return selected_result["associate_id"], selected_result["remember"]
