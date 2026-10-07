import re
import tkinter as tk
from tkinter import ttk, messagebox
from typing import Optional, Callable, List, Tuple


DEFAULT_RUNNING_CLAIMS: List[Tuple[str, str, str]] = [
  ("CLM-316", "Robert Wilson", "In Progress"),
  ("CLM1003", "Robert Wilson", "In Review"),
  ("CLM1001", "John Smith", "Pending"),
  ("CLM1002", "Mary Davis", "Denied"),
  ("CLM1004", "Linda Brown", "Pending"),
  ("CLM1005", "Michael Lee", "Pending"),
  ("CLM1028", "David Miller", "In Progress"),
]


class ClaimDialog:
  """System-wide Always-On-Top floating dialogue box (Claim Work Assistant).

  Adheres to Idea_pic.jpeg Step 3 & Step 7: Displays immediately when NovaArc
  RCM is open or foreground apps switch without active claim context.
  """

  def __init__(
      self,
      on_submit: Optional[Callable[[str], None]] = None,
      on_cancel: Optional[Callable[[], None]] = None,
      running_claims: Optional[List[Tuple[str, str, str]]] = None,
  ):
    self.on_submit = on_submit
    self.on_cancel = on_cancel
    self.running_claims = running_claims or DEFAULT_RUNNING_CLAIMS
    self.claim_regex = re.compile(r"CLM\d{4,8}", re.IGNORECASE)

  def show(
      self,
      current_claim: Optional[str] = None,
      platform_name: str = "NovaArc RCM",
  ):
    root = tk.Tk()
    root.title("Claim Work Assistant — NovaArc RCM")

    # Geometry & Screen Center Adaptation
    dialog_w, dialog_h = 490, 270
    screen_w = root.winfo_screenwidth()
    screen_h = root.winfo_screenheight()
    pos_x = max(0, (screen_w - dialog_w) // 2)
    pos_y = max(0, (screen_h - dialog_h) // 2)

    root.geometry(f"{dialog_w}x{dialog_h}+{pos_x}+{pos_y}")
    root.resizable(False, False)

    # Enforce System-wide Always-On-Top (floats above any minimized/maximized window)
    root.attributes("-topmost", True)
    root.lift()
    root.focus_force()

    # Win32 HWND_TOPMOST enforcement for Windows OS
    try:
      import ctypes
      u32 = ctypes.windll.user32
      root.update_idletasks()
      hwnd = root.winfo_id()
      u32.SetWindowPos(hwnd, -1, 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0040)
      u32.SetForegroundWindow(hwnd)
    except Exception:
      pass

    # Continuously keep dialog on top even when underlying apps minimize, maximize, or gain focus
    def _keep_topmost():
      try:
        if root.winfo_exists():
          root.attributes("-topmost", True)
          root.lift()
          root.after(350, _keep_topmost)
      except Exception:
        pass

    root.after(350, _keep_topmost)

    # Executive 2D Styling (White canvas with sharp dark headers per ui-ux-pro-max-skill)
    root.configure(bg="#ffffff")

    # --- Header Bar ---
    header_frame = tk.Frame(root, bg="#0f172a", height=48)
    header_frame.pack(fill="x", side="top")

    icon_lbl = tk.Label(
        header_frame,
        text="[+]",
        font=("Segoe UI", 11, "bold"),
        fg="#ffffff",
        bg="#2563eb",
        padx=6,
        pady=2,
    )
    icon_lbl.pack(side="left", padx=(14, 8), pady=10)

    title_lbl = tk.Label(
        header_frame,
        text="Claim Work Assistant",
        font=("Segoe UI", 11, "bold"),
        fg="#ffffff",
        bg="#0f172a",
    )
    title_lbl.pack(side="left", pady=10)

    platform_badge = tk.Label(
        header_frame,
        text=platform_name,
        font=("Segoe UI", 8, "bold"),
        fg="#93c5fd",
        bg="#1e293b",
        padx=6,
        pady=2,
    )
    platform_badge.pack(side="right", padx=14, pady=10)

    # --- Body Content ---
    body_frame = tk.Frame(root, bg="#ffffff", padx=20, pady=14)
    body_frame.pack(fill="both", expand=True)

    prompt_lbl = tk.Label(
        body_frame,
        text=(
            f"A claim platform is open ({platform_name}).\nWhich claim do you"
            " want to work on?"
        ),
        font=("Segoe UI", 9, "bold"),
        fg="#0f172a",
        bg="#ffffff",
        justify="left",
    )
    prompt_lbl.pack(anchor="w", pady=(0, 10))

    # --- Unified Single Box With Dropdown ---
    dd_label = tk.Label(
        body_frame,
        text="CLAIM ID (ENTER NEW OR SELECT EXISTING):",
        font=("Segoe UI", 8, "bold"),
        fg="#475569",
        bg="#ffffff",
    )
    dd_label.pack(anchor="w", pady=(0, 5))

    dropdown_items = [
        f"{cid} — {pname} ({status})"
        for cid, pname, status in self.running_claims
    ]

    selected_idx = 0
    if current_claim:
      for idx, (cid, _, _) in enumerate(self.running_claims):
        if cid.upper() == current_claim.upper():
          selected_idx = idx
          break

    combobox_var = tk.StringVar(value=dropdown_items[selected_idx] if dropdown_items else "")
    # state="normal" allows the user to directly type a new claim ID or click arrow to choose existing
    combo = ttk.Combobox(
        body_frame,
        textvariable=combobox_var,
        values=dropdown_items,
        state="normal",
        font=("Consolas", 10),
        width=48,
    )
    combo.pack(fill="x", ipady=3, pady=(0, 4))
    combo.focus_set()

    hint_lbl = tk.Label(
        body_frame,
        text="Type a new Claim ID directly or click dropdown arrow to select an existing claim",
        font=("Segoe UI", 7),
        fg="#64748b",
        bg="#ffffff",
    )
    hint_lbl.pack(anchor="w", pady=(0, 14))

    # --- Footer Buttons ---
    btn_frame = tk.Frame(body_frame, bg="#ffffff")
    btn_frame.pack(fill="x", side="bottom", pady=(4, 0))

    def handle_confirm():
      raw_val = combobox_var.get().strip()
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
        relief="solid",
        bd=1,
        font=("Segoe UI", 8, "bold"),
        padx=14,
        pady=5,
        cursor="hand2",
    )
    cancel_btn.pack(side="left")

    submit_btn = tk.Button(
        btn_frame,
        text="Continue",
        command=handle_confirm,
        bg="#0f172a",
        fg="#ffffff",
        relief="flat",
        font=("Segoe UI", 8, "bold"),
        padx=20,
        pady=6,
        cursor="hand2",
    )
    submit_btn.pack(side="right")

    root.bind("<Return>", lambda e: handle_confirm())
    root.bind("<Escape>", lambda e: handle_cancel())
    root.protocol("WM_DELETE_WINDOW", handle_cancel)

    root.mainloop()


if __name__ == "__main__":

  def on_done(cid):
    print(f"Selected claim: {cid}")

  dialog = ClaimDialog(on_submit=on_done)
  dialog.show(current_claim="CLM1003", platform_name="NovaArc RCM")
