import re
import tkinter as tk
from tkinter import ttk, messagebox
from typing import Optional, Callable


class ClaimDialog:
    """Non-blocking Tkinter popup dialog for manual claim entry or fallback prompt."""

    def __init__(self, on_submit: Optional[Callable[[str], None]] = None):
        self.on_submit = on_submit
        self.claim_regex = re.compile(r"^CLM\d{4,8}$", re.IGNORECASE)

    def show(self, current_claim: Optional[str] = None):
        root = tk.Tk()
        root.title("TMS - Active Claim Context")
        root.geometry("360x180")
        root.resizable(False, False)
        root.attributes("-topmost", True)

        # Style
        root.configure(bg="#0f172a")

        title_lbl = tk.Label(
            root,
            text="Set Active Claim Context",
            font=("Segoe UI", 12, "bold"),
            fg="#f8fafc",
            bg="#0f172a"
        )
        title_lbl.pack(pady=(16, 4))

        sub_lbl = tk.Label(
            root,
            text="All subsequent apps will be attributed to this claim",
            font=("Segoe UI", 8),
            fg="#94a3b8",
            bg="#0f172a"
        )
        sub_lbl.pack(pady=(0, 12))

        entry_var = tk.StringVar(value=current_claim or "CLM")
        entry = tk.Entry(
            root,
            textvariable=entry_var,
            font=("Consolas", 12),
            justify="center",
            width=20,
            bg="#1e293b",
            fg="#38bdf8",
            insertbackground="#38bdf8",
            relief="flat"
        )
        entry.pack(pady=4)
        entry.focus_set()
        entry.select_range(0, tk.END)

        def handle_submit():
            val = entry_var.get().strip().upper()
            if not self.claim_regex.match(val):
                messagebox.showerror(
                    "Invalid Claim ID",
                    "Claim ID must follow format CLM followed by 4-8 digits (e.g. CLM1003).",
                    parent=root
                )
                return
            if self.on_submit:
                self.on_submit(val)
            root.destroy()

        def handle_cancel():
            root.destroy()

        btn_frame = tk.Frame(root, bg="#0f172a")
        btn_frame.pack(pady=12)

        cancel_btn = tk.Button(
            btn_frame,
            text="Cancel",
            command=handle_cancel,
            bg="#334155",
            fg="#f8fafc",
            relief="flat",
            padx=12,
            pady=4
        )
        cancel_btn.pack(side="left", padx=6)

        submit_btn = tk.Button(
            btn_frame,
            text="Set Active Claim",
            command=handle_submit,
            bg="#38bdf8",
            fg="#0f172a",
            font=("Segoe UI", 9, "bold"),
            relief="flat",
            padx=12,
            pady=4
        )
        submit_btn.pack(side="left", padx=6)

        root.bind("<Return>", lambda e: handle_submit())
        root.bind("<Escape>", lambda e: handle_cancel())

        root.mainloop()


if __name__ == "__main__":
    def print_claim(cid):
        print(f"Selected claim: {cid}")

    dialog = ClaimDialog(on_submit=print_claim)
    dialog.show("CLM1003")
