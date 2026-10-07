import os
import sys
import json
import time
import uuid
import signal
from datetime import datetime, timezone
import threading
import requests

agent_dir = os.path.dirname(os.path.abspath(__file__))
if agent_dir not in sys.path:
    sys.path.insert(0, agent_dir)

from tracker import WindowTracker
from idle_monitor import IdleMonitor
from claim_context import ClaimContextManager
from emitter import EventEmitter
from dialog import ClaimDialog
from tray import TrayIcon


def load_config() -> dict:
    default_config = {
        "associate_id": "EMP101",
        "backend_url": "http://localhost:8000/api/events",
        "session_start_url": "http://localhost:8000/api/sessions/start",
        "session_end_url": "http://localhost:8000/api/sessions/end",
        "poll_interval_sec": 1,
        "idle_threshold_sec": 60,
        "untracked_warning_sec": 300,
        "claim_regex": "CLM\\d{4,8}",
        "batch_size": 10,
        "flush_interval_sec": 30,
        "agent_version": "1.0.0",
        "enable_tray": True
    }
    cfg_path = os.path.join(os.path.dirname(__file__), "config.json")
    if os.path.exists(cfg_path):
        try:
            with open(cfg_path, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                default_config.update(loaded)
        except Exception as e:
            print(f"[Agent] Warning loading config.json: {e}")
    return default_config


class TMSDesktopAgent:
    """Core desktop daemon orchestrating window tracking, idle monitoring, and claim context."""

    def __init__(self, enable_tray: bool = True):
        self.config = load_config()
        self.associate_id = self.config["associate_id"]
        self.session_id = f"sess-{uuid.uuid4().hex[:8]}"
        self.running = False
        self.enable_tray = enable_tray and self.config.get("enable_tray", True)

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
        self.dialog_dismissed_time = 0.0

        # System tray setup
        self.tray = TrayIcon(
            associate_id=self.associate_id,
            on_open_dialog=self.prompt_manual_claim,
            on_exit=self.stop_session
        )

    def prompt_manual_claim(self, platform_name: str = "NovaArc RCM"):
        """Opens non-blocking Tkinter modal to set active claim manually."""
        if self.dialog_open:
            return

        print(f"\n[***] CLAIM WORK ASSISTANT DIALOG ACTIVATED ({platform_name}) [***]")

        # Fetch recent running claims from backend if available for dropdown
        running_claims = None
        try:
            r = requests.get(f"http://localhost:8000/api/associate/{self.associate_id}/today", timeout=1.0)
            if r.status_code == 200:
                data = r.json()
                recents = data.get("recent_claims", [])
                if recents:
                    running_claims = []
                    for item in recents:
                        cid = item.get("claim_id")
                        if cid and cid != "UNASSIGNED":
                            status = item.get("status", "In Progress")
                            running_claims.append((cid, "Active Claim", status))
        except Exception:
            pass

        def _on_cancel():
            self.dialog_dismissed_time = time.time()

        def _show():
            self.dialog_open = True
            try:
                curr = self.claim_context.get_current_claim_id()
                curr_param = curr if curr != "UNASSIGNED" else None
                dialog = ClaimDialog(
                    on_submit=self._on_manual_claim_submitted,
                    on_cancel=_on_cancel,
                    running_claims=running_claims
                )
                dialog.show(current_claim=curr_param, platform_name=platform_name)
            except Exception as e:
                print(f"[Agent] Error displaying ClaimDialog: {e}")
            finally:
                self.dialog_open = False

        t = threading.Thread(target=_show, daemon=True)
        t.start()

    def _on_manual_claim_submitted(self, claim_id: str):
        print(f"[Agent] Manual claim override submitted: {claim_id}")
        self.claim_context.update_detected_claim(claim_id)
        self.untracked_seconds = 0
        self.dialog_dismissed_time = 0.0
        self.tray.update_claim(claim_id)

        # Notify backend so dashboard immediately updates in real-time
        try:
            requests.post(
                f"http://localhost:8000/api/associate/{self.associate_id}/active-claim",
                json={"claim_id": claim_id, "status": "IN_PROGRESS"},
                timeout=1.5
            )
        except Exception:
            pass

        # Enqueue explicit claim detection event
        self.emitter.enqueue({
            "associate_id": self.associate_id,
            "session_id": self.session_id,
            "claim_id": claim_id,
            "event_type": "CLAIM_DETECTED",
            "app_name": self.last_app or "NovaArc RCM",
            "window_title": f"Manual Claim Assignment: {claim_id}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "is_idle": False,
            "agent_version": self.config["agent_version"]
        })

    def _setup_hotkey_listener(self):
        """Initializes global hotkey listener (Ctrl+Shift+C) using pynput if available."""
        try:
            from pynput import keyboard

            def on_activate():
                print("[Agent] Hotkey Ctrl+Shift+C pressed! Opening claim entry dialog...")
                self.prompt_manual_claim()

            listener = keyboard.GlobalHotKeys({
                "<ctrl>+<shift>+c": on_activate
            })
            listener.daemon = True
            listener.start()
            print("[Agent] Global hotkey registered: Ctrl+Shift+C for manual claim entry.")
        except Exception as e:
            print(f"[Agent] Note: Global hotkey disabled ({e}). Standard auto-detection active.")

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
                now_iso = datetime.now(timezone.utc).isoformat()
                app_name, title, detected_claim = self.tracker.get_active_window()
                idle_status = self.idle_monitor.is_idle()
                idle_transition = self.idle_monitor.check_idle_transition()

                # 0. Periodically sync manual claim assignment from Web Dashboard
                self.sync_counter += 1
                if self.sync_counter % 2 == 0:
                    try:
                        active_url = f"http://localhost:8000/api/associate/{self.associate_id}/active-claim"
                        resp = requests.get(active_url, timeout=1.0)
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

                # 0a. Detect NovaArc RCM Platform and Authentication State
                hwnd = 0
                try:
                    import ctypes
                    hwnd = ctypes.windll.user32.GetForegroundWindow()
                except Exception:
                    pass

                is_office = self.tracker.is_office_platform(app_name, title)
                is_login_page = self.tracker.is_novaarc_login_page(app_name, title, hwnd) if is_office else False
                is_authenticated = self.tracker.is_novaarc_authenticated(app_name, title, hwnd) if is_office else False

                # Check for App Switch
                has_app_changed = (app_name != self.last_app) or (title != self.last_title)

                # 1. Update Claim Context
                active_claim, has_switched = self.claim_context.update_detected_claim(detected_claim)
                self.tray.update_claim(active_claim)

                # 1b. MANDATORY CLAIM WORK ASSISTANT TRIGGERS:
                # Per User Requirement: Dialogue box triggers strictly AFTER sign-in or login into NovaArc platform!
                if not self.dialog_open and not idle_status:
                    if is_office:
                        if is_login_page:
                            # User is on the login/sign-in screen: DO NOT trigger dialogue box
                            if self.sync_counter % 10 == 0:
                                print(f"[*] NovaArc login page visible ('{title[:35]}'). Awaiting sign-in...")
                        elif is_authenticated:
                            # User has successfully signed in / logged in to NovaArc platform!
                            if not self.has_logged_in_to_office:
                                self.has_logged_in_to_office = True
                                self.office_platform_detected = True
                                print(f"[*] MANDATORY TRIGGER: Employee signed in to NovaArc RCM ('{title[:40]}'). Popping Claim Work Assistant immediately...")
                                self.prompt_manual_claim(platform_name="NovaArc RCM")
                            elif has_app_changed:
                                if active_claim == "UNASSIGNED":
                                    print(f"[*] Switched to NovaArc RCM without claim context. Prompting assistant...")
                                    self.prompt_manual_claim(platform_name="NovaArc RCM")

                    # TRIGGER B: Only AFTER employee has logged in to the platform,
                    # opening or switching to any app or browser triggers the dialogue box immediately!
                    elif self.has_logged_in_to_office and has_app_changed:
                        if active_claim == "UNASSIGNED" or self.last_app == "NovaArc RCM":
                            print(f"[*] MANDATORY TRIGGER: Switched to '{app_name}' ('{title[:35]}'). Popping Claim Work Assistant immediately...")
                            self.prompt_manual_claim(platform_name="NovaArc RCM")


                # 2. Check for Claim Switch Event
                if has_switched:
                    print(f"[*] NEW CLAIM DETECTED: {active_claim} (Window: '{title[:40]}...')")
                    self.untracked_seconds = 0
                    self.emitter.enqueue({
                        "associate_id": self.associate_id,
                        "session_id": self.session_id,
                        "claim_id": active_claim,
                        "event_type": "CLAIM_DETECTED",
                        "app_name": app_name,
                        "window_title": title,
                        "timestamp": now_iso,
                        "is_idle": idle_status,
                        "agent_version": self.config["agent_version"]
                    })

                # 3. Check for Untracked Window Warning (5+ minutes without claim context)
                if active_claim == "UNASSIGNED" and not idle_status:
                    self.untracked_seconds += self.config["poll_interval_sec"]
                    if self.untracked_seconds >= self.config["untracked_warning_sec"]:
                        print("[TMS Alert] Notice: Active on desktop for 5+ minutes without a detected claim.")
                        print("Opening manual claim entry dialog...")
                        self.prompt_manual_claim(platform_name="NovaArc RCM")
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
                        "app_name": app_name,
                        "window_title": title,
                        "timestamp": now_iso,
                        "is_idle": idle_status,
                        "agent_version": self.config["agent_version"]
                    })

                # 5. Check for App Switch or Heartbeat
                event_type = "APP_SWITCH" if has_app_changed else "HEARTBEAT"

                if has_app_changed:
                    print(f" -> App: {app_name:<15} | Claim: {self.claim_context.get_current_claim_id():<10} | Idle: {idle_status}")

                self.emitter.enqueue({
                    "associate_id": self.associate_id,
                    "session_id": self.session_id,
                    "claim_id": self.claim_context.get_current_claim_id(),
                    "event_type": event_type,
                    "app_name": app_name,
                    "window_title": title,
                    "timestamp": now_iso,
                    "is_idle": idle_status,
                    "agent_version": self.config["agent_version"]
                })

                self.last_app = app_name
                self.last_title = title

                time.sleep(self.config["poll_interval_sec"])

        except Exception as e:
            print(f"[Agent] Error during runtime: {e}")
            self.stop_session()


if __name__ == "__main__":
    agent = TMSDesktopAgent()
    agent.run()
