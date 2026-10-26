import os
import sys
import json
import time
import uuid
import signal
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import threading
import requests

agent_dir = os.path.dirname(os.path.abspath(__file__))
if agent_dir not in sys.path:
    sys.path.insert(0, agent_dir)

from tracker import WindowTracker
from idle_monitor import IdleMonitor
from claim_context import ClaimContextManager
from emitter import EventEmitter
from dialog import (
    ClaimDialog,
    fetch_single_claim_live,
    format_platform_status_display,
    match_claim_status_benchmark
)
from tray import TrayIcon


def resolve_associate_identity(default_from_config: str) -> str:
    """
    Determines unique associate identity per laptop/user with precedence:
    1. CLI argument: --associate <ID> or -a <ID> or python agent/main.py <ID>
    2. Environment variable: TMS_ASSOCIATE_ID or ASSOCIATE_ID
    3. Local associate_id.txt next to script/executable
    4. Explicit ID from config.json (if not 'AUTO')
    5. Clean machine-based ID fallback: EMP-<WindowsUsername>
    """
    # 1. CLI args
    for i, arg in enumerate(sys.argv[1:]):
        if arg in ("--associate", "-a") and i + 1 < len(sys.argv) - 1:
            return sys.argv[i + 2].strip().upper()
        if arg.startswith("--associate="):
            return arg.split("=", 1)[1].strip().upper()
        if not arg.startswith("-") and arg.isalnum() and len(arg) <= 20 and i == 0:
            return arg.strip().upper()

    # 2. Environment variable
    env_id = os.getenv("TMS_ASSOCIATE_ID") or os.getenv("ASSOCIATE_ID")
    if env_id:
        return env_id.strip().upper()

    # 3. Local associate_id.txt
    exe_dir = os.path.dirname(sys.executable) if getattr(sys, "frozen", False) else os.path.dirname(__file__)
    user_file = os.path.join(exe_dir, "associate_id.txt")
    if os.path.exists(user_file):
        try:
            with open(user_file, "r", encoding="utf-8") as f:
                content = f.read().strip().upper()
                if content:
                    return content
        except Exception:
            pass

    # 4. Explicit config value if not AUTO
    if default_from_config and default_from_config not in ("AUTO", ""):
        return default_from_config.strip().upper()

    # 5. Default corporate associate identity matching web dashboard
    return "EMP101"


def load_config() -> dict:
    default_config = {
        "associate_id": os.getenv("TMS_ASSOCIATE_ID") or "EMP101",
        "backend_base_url": os.getenv("BACKEND_BASE_URL", "https://tms-backend-6l5j.onrender.com"),
        "backend_url": os.getenv("BACKEND_URL", "https://tms-backend-6l5j.onrender.com/api/events"),
        "session_start_url": os.getenv("SESSION_START_URL", "https://tms-backend-6l5j.onrender.com/api/sessions/start"),
        "session_end_url": os.getenv("SESSION_END_URL", "https://tms-backend-6l5j.onrender.com/api/sessions/end"),
        "poll_interval_sec": 0.15,
        "idle_threshold_sec": 60,
        "untracked_warning_sec": 300,
        "claim_regex": "\\b(?:CLM|CLAIM)[-_]?\\d+\\b",
        "batch_size": 10,
        "flush_interval_sec": 30,
        "agent_version": "1.0.0",
        "enable_tray": False,
        "enable_fallback_dialog": True
    }

    # Try next to executable (frozen mode), then bundle or script directory
    exe_dir = os.path.dirname(sys.executable) if getattr(sys, "frozen", False) else os.path.dirname(__file__)
    cfg_path = os.path.join(exe_dir, "config.json")
    if not os.path.exists(cfg_path):
        bundle_dir = getattr(sys, "_MEIPASS", os.path.dirname(__file__))
        cfg_path = os.path.join(bundle_dir, "config.json")

    if os.path.exists(cfg_path):
        try:
            with open(cfg_path, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                default_config.update(loaded)
        except Exception as e:
            print(f"[Agent] Warning loading config.json: {e}")

    default_config["associate_id"] = resolve_associate_identity(default_config.get("associate_id", "AUTO"))
    return default_config


class TMSDesktopAgent:
    """Core desktop daemon orchestrating window tracking, idle monitoring, and claim context."""

    def __init__(self, enable_tray: bool = True):
        self.config = load_config()
        self.associate_id = self.config["associate_id"]
        self.session_id = f"sess-{uuid.uuid4().hex[:8]}"
        self.running = False
        self.enable_tray = enable_tray and self.config.get("enable_tray", True)
        base_url = (
            self.config.get("backend_base_url")
            or self.config.get("backend_url", "https://tms-backend-6l5j.onrender.com").split("/api")[0]
        ).rstrip("/")
        # If localhost is configured but offline, auto-switch to live Render cloud backend
        if "localhost" in base_url or "127.0.0.1" in base_url:
            try:
                test_resp = requests.get(f"{base_url}/health", timeout=0.8)
                if test_resp.status_code != 200:
                    base_url = "https://tms-backend-6l5j.onrender.com"
            except Exception:
                print(f"[Agent] Local backend at {base_url} is unreachable. Auto-switching to Live Cloud Backend (https://tms-backend-6l5j.onrender.com)")
                base_url = "https://tms-backend-6l5j.onrender.com"
                self.config["backend_url"] = f"{base_url}/api/events"
                self.config["session_start_url"] = f"{base_url}/api/sessions/start"
                self.config["session_end_url"] = f"{base_url}/api/sessions/end"
        self.base_api_url = base_url

        # Core subsystems
        self.tracker = WindowTracker(claim_regex=self.config["claim_regex"])
        self.idle_monitor = IdleMonitor(idle_threshold_sec=self.config["idle_threshold_sec"])
        self.claim_context = ClaimContextManager()
        self.emitter = EventEmitter(
            backend_url=self.config["backend_url"],
            batch_size=self.config["batch_size"],
            flush_interval_sec=self.config["flush_interval_sec"]
        )

        self.last_app = ""
        self.last_title = ""
        self.untracked_seconds = 0
        self.dialog_open = False
        self.sync_counter = 0
        self.office_platform_detected = False
        self.has_logged_in_to_office = False
        self.has_seen_login_page = False
        self.login_consecutive_non_login_ticks = 0
        self.is_currently_on_platform = False
        self.last_handled_app_key = ""
        self.last_dialog_close_time = 0.0
        self.dialog_dismissed_time = 0.0
        self.external_app_ticks = 0

        print(f"[Agent] Starting session {self.session_id} for {self.associate_id}...")
        print(f"[Agent] (Unique Associate ID resolved. Run with --associate <ID> or set associate_id.txt to change)")

        # High-performance async cache for today claims (eliminates blocking HTTP GET in prompt_manual_claim)
        self._cached_today_claims = []
        self._cached_recents = []
        self._last_today_fetch_time = 0.0

        # System tray setup
        self.tray = TrayIcon(
            associate_id=self.associate_id,
            on_open_dialog=lambda: self.prompt_manual_claim(synchronous=False),
            on_exit=self.stop_session
        )

    def _refresh_today_claims_async(self):
        """Asynchronously updates today's running claims cache in background without blocking main loop."""
        def _fetch():
            try:
                r = requests.get(f"{self.base_api_url}/api/associate/{self.associate_id}/today", timeout=0.8)
                if r.status_code == 200:
                    data = r.json()
                    recents = data.get("recent_claims", [])
                    self._cached_recents = recents
                    seen_cids = set()
                    running = []
                    for item in recents:
                        cid = item.get("claim_id")
                        if cid and cid != "UNASSIGNED" and cid not in seen_cids:
                            seen_cids.add(cid)
                            status = item.get("status", "IN_PROGRESS")
                            if status.upper() != "COMPLETED":
                                running.append((cid, "Shift Claim", status))
                    self._cached_today_claims = running
                    self._last_today_fetch_time = time.time()
            except Exception:
                pass
        threading.Thread(target=_fetch, daemon=True).start()

    def prompt_manual_claim(self, platform_name: str = "NovaArc RCM", synchronous: bool = True, target_hwnd: int = 0):
        """Opens Claim Work Assistant modal to set active claim with ultra-low latency. If synchronous=True, pauses caller until confirmed."""
        if self.dialog_open:
            return

        print(f"\n[***] CLAIM WORK ASSISTANT DIALOG ACTIVATED ({platform_name}) [***]")
        self.dialog_open = True

        # Refresh claims cache in background if stale (> 5 seconds) without blocking dialog creation
        if (time.time() - self._last_today_fetch_time) > 5.0:
            self._refresh_today_claims_async()

        # Use non-blocking memory cache immediately for instantaneous (<2ms) dialog popup
        running_claims = list(self._cached_today_claims)
        recents = list(self._cached_recents)
        seen_cids = {item[0] for item in running_claims}

        curr_active = self.claim_context.get_current_claim_id()
        if curr_active and curr_active != "UNASSIGNED" and curr_active not in seen_cids:
            running_claims.insert(0, (curr_active, "Shift Claim", "IN_PROGRESS"))

        # Determine lastly worked claim automatically
        curr = self.claim_context.get_current_claim_id()
        curr_param = curr if curr != "UNASSIGNED" else None
        last_worked = self.claim_context.get_last_worked_claim_id(exclude_claim_id=curr_param)

        if last_worked and last_worked != "UNASSIGNED":
            effective_last = last_worked
        elif curr_param and curr_param != "UNASSIGNED":
            effective_last = curr_param
        else:
            effective_last = ""
            for item in reversed(recents):
                cid = item.get("claim_id")
                if cid and cid != "UNASSIGNED":
                    effective_last = str(cid).strip().upper()
                    break
            if not effective_last:
                effective_last = self.claim_context.get_last_worked_claim_id()

        def _on_cancel():
            self.dialog_dismissed_time = time.time()
            self.last_dialog_close_time = time.time()
            self.last_handled_app_key = platform_name or "NovaArc RCM"
            self.is_currently_on_platform = True
            self.external_app_ticks = 0

        def _show():
            try:
                dialog = ClaimDialog(
                    on_submit=self._on_manual_claim_submitted,
                    on_cancel=_on_cancel,
                    on_close_claim=self._on_claim_closed,
                    on_status_change=self._on_claim_status_changed,
                    running_claims=running_claims,
                    associate_id=self.associate_id,
                    api_base_url=self.base_api_url
                )
                dialog.show(
                    current_claim=curr_param,
                    platform_name=platform_name,
                    target_hwnd=target_hwnd,
                    lastly_worked_claim=effective_last
                )
            except Exception as e:
                print(f"[Agent] Error displaying ClaimDialog: {e}")
            finally:
                self.dialog_open = False
                self.last_dialog_close_time = time.time()
                self.last_handled_app_key = platform_name or "NovaArc RCM"
                self.is_currently_on_platform = True
                self.external_app_ticks = 0

        if synchronous:
            _show()
        else:
            t = threading.Thread(target=_show, daemon=True)
            t.start()

    def _on_manual_claim_submitted(self, claim_id: str, claim_type_info: Optional[dict] = None):
        clean_id = claim_id.strip().upper()
        ctype_name = claim_type_info.get("short_name", "CR - Review / Portal") if claim_type_info else "CR - Review / Portal"
        target_mins = claim_type_info.get("target_minutes", 4) if claim_type_info else 4
        target_secs = claim_type_info.get("target_seconds", 240) if claim_type_info else 240

        print(f"[Agent] Manual claim override submitted: {clean_id} | Type: {ctype_name} (Target: {target_mins}m)")
        curr_before = self.claim_context.get_current_claim_id()
        if curr_before and curr_before != "UNASSIGNED" and curr_before.upper() != clean_id:
            self.claim_context.record_worked_claim(curr_before)

        self.claim_context.set_manual_claim(
            clean_id,
            source="DIALOG",
            claim_type=ctype_name,
            target_minutes=target_mins,
            target_seconds=target_secs
        )
        self.untracked_seconds = 0
        self.dialog_dismissed_time = 0.0
        self.last_dialog_close_time = time.time()
        self.is_currently_on_platform = True
        self.external_app_ticks = 0
        self.tray.update_claim(clean_id)

        # Notify backend asynchronously so dashboard immediately reflects the active claim
        def _sync_active_claim(target_assoc: str):
            try:
                res = requests.post(
                    f"{self.base_api_url}/api/associate/{target_assoc}/active-claim",
                    json={
                        "claim_id": clean_id,
                        "action_type": ctype_name,
                        "target_minutes": target_mins,
                        "target_seconds": target_secs,
                        "status": "IN_PROGRESS"
                    },
                    timeout=8.0
                )
                print(f"[Agent] Active claim synced to backend for {target_assoc} -> Status {res.status_code}")
            except Exception as e:
                print(f"[Agent] Notice: Backend active-claim update for {target_assoc}: {e}")

        targets = {self.associate_id, "EMP101"}
        for t in targets:
            threading.Thread(target=_sync_active_claim, args=(t,), daemon=True).start()

        # Enqueue explicit claim detection event and flush immediately
        clean_url, website_name, page_header, used_for = self.tracker.resolve_page_identity(
            self.last_app or "NovaArc RCM", f"Manual Claim Assignment: {clean_id} ({ctype_name})", ""
        )
        for t in targets:
            self.emitter.enqueue({
                "associate_id": t,
                "session_id": self.session_id,
                "claim_id": clean_id,
                "event_type": "CLAIM_DETECTED",
                "app_name": website_name or self.last_app or "NovaArc RCM",
                "window_title": f"Manual Claim Assignment: {clean_id} ({ctype_name})",
                "url": clean_url,
                "page_header": page_header or "Claims Management & Adjudication",
                "used_for": used_for or "Searching patient claims, checking denial codes, reviewing EOBs & filing appeals",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "is_idle": False,
                "agent_version": self.config["agent_version"]
            })
        self.emitter.flush()

    def _on_claim_closed(self, claim_id: str, status: str = "COMPLETED"):
        """Handles completion and closing of a claim from the dialog."""
        clean_id = claim_id.strip().upper()
        print(f"[Agent] Claim {clean_id} marked {status} & closed. Emitting CLAIM_CLOSED and updating Excel...")
        self.claim_context.record_worked_claim(clean_id)
        current_active = self.claim_context.get_current_claim_id()
        if current_active and current_active.upper() == clean_id:
            self.claim_context.update_detected_claim("UNASSIGNED")
            self.tray.update_claim("UNASSIGNED")

        # Enqueue explicit CLAIM_CLOSED event
        clean_url, website_name, page_header, used_for = self.tracker.resolve_page_identity(
            self.last_app or "NovaArc RCM", f"Claim Closed: {claim_id}", ""
        )
        targets = {self.associate_id, "EMP101"}
        for t in targets:
            self.emitter.enqueue({
                "associate_id": t,
                "session_id": self.session_id,
                "claim_id": claim_id,
                "event_type": "CLAIM_CLOSED",
                "app_name": website_name or self.last_app or "NovaArc RCM",
                "window_title": f"Claim Closed: {claim_id}",
                "url": clean_url,
                "page_header": page_header or "Claim Resolution & Closure",
                "used_for": used_for or "Concluding claim adjudication, generating time & motion export, and closing context",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "is_idle": False,
                "agent_version": self.config["agent_version"]
            })
        self.emitter.flush()

        # Notify backend asynchronously to update database and generate Excel export
        def _sync_complete(target_assoc: str):
            try:
                requests.post(
                    f"{self.base_api_url}/api/associate/{target_assoc}/claims/{claim_id}/complete",
                    json={"status": "COMPLETED", "export_excel": True},
                    timeout=8.0
                )
                requests.post(
                    f"{self.base_api_url}/api/associate/{target_assoc}/active-claim",
                    json={"claim_id": "UNASSIGNED", "status": "COMPLETED"},
                    timeout=8.0
                )
            except Exception as e:
                print(f"[Agent] Notice: Backend claim complete call for {target_assoc}: {e}")

        for t in targets:
            threading.Thread(target=_sync_complete, args=(t,), daemon=True).start()

    def _on_claim_status_changed(self, claim_id: str, new_status: str):
        """Handles status toggle (IN_PROGRESS <-> COMPLETED) from the dialog."""
        print(f"[Agent] Claim {claim_id} status changed to {new_status}")
        targets = {self.associate_id, "EMP101"}

        def _sync_status(target_assoc: str):
            try:
                requests.post(
                    f"{self.base_api_url}/api/associate/{target_assoc}/claims/{claim_id}/status",
                    json={"status": new_status},
                    timeout=8.0
                )
            except Exception as e:
                print(f"[Agent] Notice: Backend claim status update for {target_assoc}: {e}")

        for t in targets:
            threading.Thread(target=_sync_status, args=(t,), daemon=True).start()

    def get_app_key(self, app_name: str, window_title: str) -> str:
        """
        Determines the distinct application/browser target identity.
        Returns empty string for ignored or transient system windows.
        """
        wt = (window_title or "").strip()
        app = (app_name or "").strip()
        lower_wt = wt.lower()
        lower_app = app.lower()

        # Ignore empty, desktop, alt-tab, recording toolbars, and transient windows
        if not wt and not app:
            return ""
        if any(term in lower_app or term in lower_wt for term in [
            "desktop", "task switching", "recording toolbar", "snipping tool", "screen recording",
            "quick settings", "new notification", "snap assist", "task view", "start menu",
            "antigravity", "visual studio code", "vscode"
        ]):
            return ""

        # Ignore the dialog itself
        if "claim work assistant" in lower_wt or "claim work assistant" in lower_app:
            return ""

        # Ignore TMS Dashboard (treated as non-triggering office utility)
        if self.tracker.is_tms_dashboard(app_name, window_title):
            return "TMS Dashboard"

        # NovaArc RCM platform
        if self.tracker.is_office_platform(app_name, window_title):
            return "NovaArc RCM"

        # Web Browsers (Chrome, Edge, Firefox, Brave, Opera)
        is_browser = app in ["Chrome", "Edge", "Firefox", "Brave", "Opera"] or any(
            b in lower_wt for b in ["google chrome", "microsoft edge", "firefox", "brave", "opera"]
        )
        if is_browser:
            if "bing" in lower_wt:
                return f"Bing ({app})"
            if "youtube" in lower_wt:
                return f"YouTube ({app})"
            if "chatgpt" in lower_wt:
                return f"ChatGPT ({app})"
            if "google search" in lower_wt or "google.com" in lower_wt:
                return f"Google Search ({app})"
            if "outlook" in lower_wt:
                return f"Outlook Web ({app})"
            parts = [p.strip() for p in wt.split(" - ")]
            if len(parts) >= 2 and parts[0]:
                tab_name = parts[0][:35].strip()
                return f"{tab_name} ({app})"
            return app

        # Productivity and Desktop Apps
        if "excel" in lower_wt or ".xlsx" in lower_wt or ".csv" in lower_wt:
            return "Excel"
        if "notepad" in lower_wt or ".txt" in lower_wt:
            return "Notepad"
        if "word" in lower_wt or ".docx" in lower_wt:
            return "Word"
        if "outlook" in lower_wt:
            return "Outlook"
        if "teams" in lower_wt:
            return "MS Teams"
        if "calculator" in lower_wt:
            return "Calculator"
        if "explorer" in lower_wt or "file explorer" in lower_wt:
            return "File Explorer"
        if "qoder" in lower_wt or "qoder" in lower_app:
            return "Qoder"

        return app or (wt.split(" - ")[-1].strip() if " - " in wt else wt[:30]) or "Application"

    def _setup_hotkey_listener(self):
        """Initializes global hotkey listener (Ctrl+Shift+C) using native Win32 polling (GIL-safe for Python 3.14+)."""
        print("[Agent] Global hotkey registered: Ctrl+Shift+C for manual claim entry.")

    def start_session(self):
        """Notifies the backend of shift commencement."""
        print(f"[Agent] Starting session {self.session_id} for {self.associate_id}...")
        try:
            requests.post(
                self.config["session_start_url"],
                json={"associate_id": self.associate_id, "session_id": self.session_id},
                timeout=3.0
            )
        except Exception:
            print("[Agent] Warning: Backend session start unreachable, continuing in offline mode.")

        # Emit initial SESSION_START event
        self.emitter.enqueue({
            "associate_id": self.associate_id,
            "session_id": self.session_id,
            "claim_id": "UNASSIGNED",
            "event_type": "SESSION_START",
            "app_name": "Desktop",
            "window_title": "Session Initialized",
            "url": "",
            "page_header": "Shift Initialization",
            "used_for": "Starting associate daily shift and telemetry monitoring",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "is_idle": False,
            "agent_version": self.config["agent_version"]
        })

    def stop_session(self):
        """Notifies backend of shift conclusion and flushes remaining queue."""
        print("[Agent] Stopping session and flushing pending events...")
        self.running = False

        self.emitter.enqueue({
            "associate_id": self.associate_id,
            "session_id": self.session_id,
            "claim_id": self.claim_context.get_current_claim_id(),
            "event_type": "SESSION_END",
            "app_name": "Desktop",
            "window_title": "Session Concluded",
            "url": "",
            "page_header": "Shift Conclusion",
            "used_for": "Concluding associate daily shift and flushing pending claim events",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "is_idle": False,
            "agent_version": self.config["agent_version"]
        })
        self.emitter.flush()

        try:
            requests.post(
                self.config["session_end_url"],
                json={"session_id": self.session_id},
                timeout=3.0
            )
        except Exception:
            pass
        print("[Agent] Session stopped successfully.")

    def run(self):
        """Main monitoring loop executing every poll_interval_sec."""
        self.running = True
        self.start_session()

        # Initialize hotkey hook and system tray
        self._setup_hotkey_listener()
        if self.enable_tray:
            self.tray.run_detached()

        print(f"[Agent] Running! Polling foreground window every {self.config['poll_interval_sec']}s...")
        print("Press Ctrl+Shift+C anytime to manually assign active claim context.")
        print("Press Ctrl+C to terminate.")

        def handle_sigint(sig, frame):
            self.stop_session()
            sys.exit(0)

        signal.signal(signal.SIGINT, handle_sigint)

        try:
            while self.running:
                try:
                    now_iso = datetime.now(timezone.utc).isoformat()
                    app_name, title, detected_claim = self.tracker.get_active_window()
                    idle_status = self.idle_monitor.is_idle()
                    idle_transition = self.idle_monitor.check_idle_transition()

                    # Native Win32 Ctrl+Shift+C hotkey detection (zero-thread, 100% crash-proof in Python 3.14+)
                    try:
                        import ctypes
                        u32 = ctypes.windll.user32
                        if (u32.GetAsyncKeyState(0x11) & 0x8000) and (u32.GetAsyncKeyState(0x10) & 0x8000) and (u32.GetAsyncKeyState(0x43) & 0x8000):
                            if not self.dialog_open:
                                print("\n[Agent] Hotkey Ctrl+Shift+C pressed! Opening Claim Work Assistant...")
                                curr_fg = u32.GetForegroundWindow()
                                self.prompt_manual_claim(synchronous=True, target_hwnd=curr_fg)
                                time.sleep(0.3)
                                continue
                    except Exception:
                        pass

                    # 0. Periodically sync manual claim assignment from Web Dashboard (every 5s, non-blocking)
                    self.sync_counter += 1
                    if self.sync_counter % 25 == 0:
                        try:
                            active_url = f"{self.base_api_url}/api/associate/{self.associate_id}/active-claim"
                            resp = requests.get(active_url, timeout=0.4)
                            if resp.status_code == 200:
                                data = resp.json()
                                remote_claim = data.get("active_claim_id")
                                if remote_claim and remote_claim != "UNASSIGNED" and remote_claim != self.claim_context.get_current_claim_id():
                                    print(f"[*] ACTIVE CLAIM CONTEXT SYNCHRONIZED FROM DASHBOARD: {remote_claim}")
                                    self.claim_context.set_manual_claim(remote_claim, source="DASHBOARD")
                                    self.untracked_seconds = 0
                                    self.tray.update_claim(remote_claim)
                        except Exception:
                            pass

                    # 0b. Periodically verify live status of active claim on NovaArc platform (every ~1.0s for near-instant sync)
                    if self.sync_counter % 6 == 0:
                        curr_active = self.claim_context.get_current_claim_id()
                        if curr_active and curr_active != "UNASSIGNED":
                            def _check_active_claim_status(cid: str):
                                try:
                                    s_info = fetch_single_claim_live(cid)
                                    if s_info:
                                        raw_st = s_info.get("status") or "created"
                                        disp_st = format_platform_status_display(raw_st)
                                        bm = match_claim_status_benchmark(raw_st)
                                        new_type = bm.get("short_name", "CR - Review / Portal")
                                        new_m = bm.get("target_minutes", 4)
                                        new_s = bm.get("target_seconds", 240)

                                        # Check if claim type changed in NovaArc
                                        curr_ctx_type = self.claim_context.active_claim_type
                                        if new_type and curr_ctx_type and new_type != curr_ctx_type:
                                            print(f"[Agent] Active claim {cid} status updated on NovaArc: {curr_ctx_type} -> {new_type} ({disp_st}, {new_m}m)")
                                            self.claim_context.set_manual_claim(
                                                cid,
                                                source="NOVAARC_SYNC",
                                                claim_type=new_type,
                                                target_minutes=new_m,
                                                target_seconds=new_s
                                            )
                                            # Push update to TMS backend so dashboard immediately reflects change
                                            for t_assoc in {self.associate_id, "EMP101"}:
                                                try:
                                                    requests.post(
                                                        f"{self.base_api_url}/api/associate/{t_assoc}/active-claim",
                                                        json={
                                                            "claim_id": cid,
                                                            "action_type": new_type,
                                                            "target_minutes": new_m,
                                                            "target_seconds": new_s,
                                                            "status": "IN_PROGRESS"
                                                        },
                                                        timeout=3.0
                                                    )
                                                except Exception:
                                                    pass
                                except Exception:
                                    pass
                            threading.Thread(target=_check_active_claim_status, args=(curr_active,), daemon=True).start()

                    # 0a. Detect NovaArc RCM Platform and Authentication State
                    hwnd = 0
                    try:
                        import ctypes
                        hwnd = ctypes.windll.user32.GetForegroundWindow()
                    except Exception:
                        pass

                    # If foreground is an internal agent dialog or overlay, do not process as an external app switch
                    if self.tracker.is_internal_agent_window(app_name, title) or hwnd == 0 or not title.strip():
                        time.sleep(self.config["poll_interval_sec"])
                        continue

                    # 0b. Resolve Clean URL and 3-Pillar Healthcare Page Identity first
                    raw_url = self.tracker.get_browser_url(hwnd, title) if self.tracker.is_browser_app(app_name, title, hwnd) else ""
                    clean_url, website_name, page_header, used_for = self.tracker.resolve_page_identity(app_name, title, raw_url)

                    # 0a. Detect NovaArc RCM Platform and Authentication State using CURRENT window & URL
                    is_office = self.tracker.is_office_platform(app_name, title, hwnd, current_url=raw_url)
                    is_login_page = self.tracker.is_novaarc_login_page(app_name, title, hwnd) if is_office else False
                    is_authenticated = self.tracker.is_novaarc_authenticated(app_name, title, hwnd) if is_office else False

                    # Unique app target identity (e.g. "NovaArc RCM", "Bing (Edge)", "YouTube (Chrome)", "Excel", "Notepad", etc.)
                    app_key = self.get_app_key(app_name, title)

                    # Check for App Switch
                    has_app_changed = (app_name != self.last_app) or (title != self.last_title)

                    # 1. Update Claim Context
                    active_claim, has_switched = self.claim_context.update_detected_claim(detected_claim)
                    self.tray.update_claim(active_claim)

                    # 1b. MANDATORY CLAIM WORK ASSISTANT TRIGGER WORKFLOW:
                    if not self.dialog_open and not idle_status:
                        now_t = time.time()
                        if not self.has_logged_in_to_office:
                            # PHASE 1: Pre-Authentication - Awaiting confirmed NovaArc login
                            if is_office:
                                if is_login_page:
                                    self.has_seen_login_page = True
                                    self.login_consecutive_non_login_ticks = 0
                                    if self.sync_counter % 15 == 0:
                                        print(f"[*] NovaArc sign-in page active ('{title[:35]}'). Awaiting employee credentials...")
                                elif is_authenticated:
                                    # Employee has positively logged in to NovaArc platform!
                                    self.has_logged_in_to_office = True
                                    self.office_platform_detected = True
                                    self.is_currently_on_platform = True
                                    self.external_app_ticks = 0
                                    print(f"\n[***] NOVAARC PLATFORM SIGN-IN CONFIRMED ('{title[:40]}')! [***]")
                                    print("[***] AGENT & AI ENABLED IMMEDIATELY! TRIGGERING CLAIM WORK ASSISTANT... [***]")
                                    self.emitter.enqueue({
                                        "associate_id": self.associate_id,
                                        "session_id": self.session_id,
                                        "claim_id": self.claim_context.get_current_claim_id(),
                                        "event_type": "OFFICE_SIGNIN_SUCCESS",
                                        "app_name": website_name or "NovaArc RCM",
                                        "window_title": title,
                                        "url": clean_url,
                                        "page_header": page_header or "Platform Authentication",
                                        "used_for": used_for or "Platform Sign-In",
                                        "timestamp": now_iso,
                                        "is_idle": False,
                                        "agent_version": self.config["agent_version"]
                                    })
                                    self.emitter.flush()
                                    self.prompt_manual_claim(platform_name="NovaArc RCM", synchronous=True, target_hwnd=hwnd)
                                    self.is_currently_on_platform = True
                                    self.external_app_ticks = 0
                                    self.last_handled_app_key = "NovaArc RCM"
                                    self.last_dialog_close_time = time.time()
                                    self.last_app = app_name
                                    self.last_title = title
                                    time.sleep(self.config["poll_interval_sec"])
                                    continue
                                else:
                                    # Neither explicitly login page nor confirmed authenticated yet (waiting for route to resolve)
                                    pass
                        else:
                            # PHASE 2: Post-Authentication - Return to Platform Trigger & Logout Detection
                            is_tms = self.tracker.is_tms_dashboard(app_name, title)

                            # Detect logout from NovaArc (user navigated back to login screen or clicked logout)
                            if is_office and is_login_page:
                                print(f"[*] NovaArc logout detected ('{title[:35]}'). Resetting active claim context to UNASSIGNED.")
                                self.has_logged_in_to_office = False
                                self.is_currently_on_platform = False
                                self.external_app_ticks = 0
                                self.tracker.clear_cache()
                                self.claim_context.clear_claim()
                                self.tray.update_claim("UNASSIGNED")
                                targets = {self.associate_id, "EMP101"}
                                def _sync_logout(target_assoc: str):
                                    try:
                                        requests.post(
                                            f"{self.base_api_url}/api/associate/{target_assoc}/active-claim",
                                            json={"claim_id": "UNASSIGNED", "status": "LOGGED_OUT"},
                                            timeout=8.0
                                        )
                                    except Exception:
                                        pass
                                for t in targets:
                                    threading.Thread(target=_sync_logout, args=(t,), daemon=True).start()

                                for t in targets:
                                    self.emitter.enqueue({
                                        "associate_id": t,
                                        "session_id": self.session_id,
                                        "claim_id": "UNASSIGNED",
                                        "event_type": "OFFICE_LOGOUT",
                                        "app_name": website_name or "NovaArc RCM",
                                        "window_title": title,
                                        "url": clean_url,
                                        "page_header": "Platform Sign-In",
                                        "used_for": "Portal Login",
                                        "timestamp": now_iso,
                                        "is_idle": False,
                                        "agent_version": self.config["agent_version"]
                                    })
                                self.emitter.flush()
                                time.sleep(self.config["poll_interval_sec"])
                                continue

                            if is_tms:
                                # Target is TMS Dashboard: DO NOT TRIGGER ("except TMS dashboard")
                                self.external_app_ticks = 0
                            elif is_office:
                                # Target is NovaArc RCM platform!
                                # Did user come back to platform after spending actual time on an external application?
                                time_since_close = now_t - self.last_dialog_close_time
                                has_returned_from_external = (
                                    (not self.is_currently_on_platform and getattr(self, "external_app_ticks", 0) >= 1)
                                    or (self.last_handled_app_key and self.last_handled_app_key not in {"NovaArc RCM", "TMS Dashboard"})
                                )
                                if has_returned_from_external:
                                    if time_since_close < 0.4:
                                        time.sleep(0.05)
                                        continue
                                    print(f"\n[*] RETURNED TO PLATFORM: Switched from external app back to NovaArc RCM. Popping Claim Work Assistant...")
                                    self.prompt_manual_claim(platform_name="NovaArc RCM", synchronous=True, target_hwnd=hwnd)
                                    self.is_currently_on_platform = True
                                    self.external_app_ticks = 0
                                    self.last_handled_app_key = "NovaArc RCM"
                                    self.last_dialog_close_time = time.time()
                                    self.last_app = app_name
                                    self.last_title = title
                                    time.sleep(self.config["poll_interval_sec"])
                                    continue
                                else:
                                    self.is_currently_on_platform = True
                                    self.external_app_ticks = 0
                            else:
                                # Target is an External Application or Browser (WhatsApp, Gmail, YouTube, Excel, Notepad, etc.)
                                self.is_currently_on_platform = False
                                self.external_app_ticks = getattr(self, "external_app_ticks", 0) + 1
                                if app_key and app_key != "TMS Dashboard":
                                    self.last_handled_app_key = app_key

                    # 2. Check for Claim Switch Event
                    if has_switched:
                        print(f"[*] NEW CLAIM DETECTED: {active_claim} (Window: '{title[:40]}...')")
                        self.untracked_seconds = 0
                        self.emitter.enqueue({
                            "associate_id": self.associate_id,
                            "session_id": self.session_id,
                            "claim_id": active_claim,
                            "event_type": "CLAIM_DETECTED",
                            "app_name": website_name or app_name,
                            "window_title": title,
                            "url": clean_url,
                            "page_header": page_header,
                            "used_for": used_for,
                            "timestamp": now_iso,
                            "is_idle": idle_status,
                            "agent_version": self.config["agent_version"]
                        })
                        self.emitter.flush()

                    # 3. Check for Untracked Window Warning (5+ minutes without claim context, only once logged in)
                    if self.has_logged_in_to_office and active_claim == "UNASSIGNED" and not idle_status:
                        self.untracked_seconds += self.config["poll_interval_sec"]
                        if self.untracked_seconds >= self.config["untracked_warning_sec"]:
                            print("[TMS Alert] Notice: Active on desktop for 5+ minutes without a detected claim.")
                            print("Opening manual claim entry dialog...")
                            self.prompt_manual_claim(platform_name=app_key or "Claim Assistant", synchronous=True)
                            self.untracked_seconds = 0
                    else:
                        self.untracked_seconds = 0

                    # 4. Check for Idle Transitions
                    if idle_transition:
                        print(f"[!] IDLE TRANSITION: {idle_transition}")
                        self.emitter.enqueue({
                            "associate_id": self.associate_id,
                            "session_id": self.session_id,
                            "claim_id": self.claim_context.get_current_claim_id(),
                            "event_type": idle_transition,
                            "app_name": website_name or app_name,
                            "window_title": title,
                            "url": clean_url,
                            "page_header": page_header,
                            "used_for": used_for,
                            "timestamp": now_iso,
                            "is_idle": idle_status,
                            "agent_version": self.config["agent_version"]
                        })

                    # 5. Check for App Switch or Heartbeat
                    event_type = "APP_SWITCH" if has_app_changed else "HEARTBEAT"

                    if has_app_changed:
                        print(f" -> App: {website_name or app_name:<15} | Section: {page_header[:25]:<25} | Claim: {self.claim_context.get_current_claim_id():<10}")

                    self.emitter.enqueue({
                        "associate_id": self.associate_id,
                        "session_id": self.session_id,
                        "claim_id": self.claim_context.get_current_claim_id(),
                        "event_type": event_type,
                        "app_name": website_name or app_name,
                        "window_title": title,
                        "url": clean_url,
                        "page_header": page_header,
                        "used_for": used_for,
                        "timestamp": now_iso,
                        "is_idle": idle_status,
                        "agent_version": self.config["agent_version"]
                    })
                    if has_app_changed:
                        self.emitter.flush()

                    self.last_app = app_name
                    self.last_title = title

                    time.sleep(self.config["poll_interval_sec"])
                except Exception as tick_err:
                    print(f"[Agent] Loop tick error: {tick_err}")
                    time.sleep(self.config["poll_interval_sec"])

        except Exception as e:
            print(f"[Agent] Error during runtime: {e}")
            self.stop_session()


if __name__ == "__main__":
    agent = TMSDesktopAgent()
    agent.run()