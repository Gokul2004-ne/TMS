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
        self.has_seen_login_page = False
        self.login_consecutive_non_login_ticks = 0
        self.is_currently_on_platform = False
        self.last_handled_app_key = ""
        self.last_dialog_close_time = 0.0
        self.dialog_dismissed_time = 0.0

        # System tray setup
        self.tray = TrayIcon(
            associate_id=self.associate_id,
            on_open_dialog=lambda: self.prompt_manual_claim(synchronous=False),
            on_exit=self.stop_session
        )

    def prompt_manual_claim(self, platform_name: str = "NovaArc RCM", synchronous: bool = True):
        """Opens Claim Work Assistant modal to set active claim. If synchronous=True, pauses caller until confirmed."""
        if self.dialog_open:
            return

        print(f"\n[***] CLAIM WORK ASSISTANT DIALOG ACTIVATED ({platform_name}) [***]")
        self.dialog_open = True

        # Fetch recent running claims from backend if available for dropdown
        running_claims = []
        try:
            r = requests.get(f"http://localhost:8000/api/associate/{self.associate_id}/today", timeout=1.0)
            if r.status_code == 200:
                data = r.json()
                recents = data.get("recent_claims", [])
                seen_cids = set()
                for item in recents:
                    cid = item.get("claim_id")
                    if cid and cid != "UNASSIGNED" and cid not in seen_cids:
                        seen_cids.add(cid)
                        status = item.get("status", "IN_PROGRESS")
                        # Only show active/in-progress claims so closed claims disappear
                        if status.upper() != "COMPLETED":
                            running_claims.append((cid, "Shift Claim", status))

                curr_active = self.claim_context.get_current_claim_id()
                if curr_active and curr_active != "UNASSIGNED" and curr_active not in seen_cids:
                    running_claims.insert(0, (curr_active, "Shift Claim", "IN_PROGRESS"))
        except Exception:
            pass

        def _on_cancel():
            self.dialog_dismissed_time = time.time()
            self.last_dialog_close_time = time.time()
            self.last_handled_app_key = platform_name

        def _show():
            try:
                curr = self.claim_context.get_current_claim_id()
                curr_param = curr if curr != "UNASSIGNED" else None
                dialog = ClaimDialog(
                    on_submit=self._on_manual_claim_submitted,
                    on_cancel=_on_cancel,
                    on_close_claim=self._on_claim_closed,
                    on_status_change=self._on_claim_status_changed,
                    running_claims=running_claims,
                    associate_id=self.associate_id
                )
                dialog.show(current_claim=curr_param, platform_name=platform_name)
            except Exception as e:
                print(f"[Agent] Error displaying ClaimDialog: {e}")
            finally:
                self.dialog_open = False
                self.last_dialog_close_time = time.time()
                self.last_handled_app_key = platform_name

        if synchronous:
            _show()
        else:
            t = threading.Thread(target=_show, daemon=True)
            t.start()

    def _on_manual_claim_submitted(self, claim_id: str):
        print(f"[Agent] Manual claim override submitted: {claim_id}")
        self.claim_context.update_detected_claim(claim_id)
        self.untracked_seconds = 0
        self.dialog_dismissed_time = 0.0
        self.last_dialog_close_time = time.time()
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

    def _on_claim_closed(self, claim_id: str, status: str = "COMPLETED"):
        """Handles completion and closing of a claim from the dialog."""
        print(f"[Agent] Claim {claim_id} marked {status} & closed. Emitting CLAIM_CLOSED and updating Excel...")
        current_active = self.claim_context.get_current_claim_id()
        if current_active and current_active.upper() == claim_id.upper():
            self.claim_context.update_detected_claim("UNASSIGNED")
            self.tray.update_claim("UNASSIGNED")

        # Enqueue explicit CLAIM_CLOSED event
        self.emitter.enqueue({
            "associate_id": self.associate_id,
            "session_id": self.session_id,
            "claim_id": claim_id,
            "event_type": "CLAIM_CLOSED",
            "app_name": self.last_app or "NovaArc RCM",
            "window_title": f"Claim Closed: {claim_id}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "is_idle": False,
            "agent_version": self.config["agent_version"]
        })

        # Notify backend to update database and generate Excel export
        try:
            requests.post(
                f"http://localhost:8000/api/associate/{self.associate_id}/claims/{claim_id}/complete",
                json={"status": "COMPLETED", "export_excel": True},
                timeout=2.0
            )
        except Exception as e:
            print(f"[Agent] Notice: Backend claim complete call: {e}")

    def _on_claim_status_changed(self, claim_id: str, new_status: str):
        """Handles status toggle (IN_PROGRESS <-> COMPLETED) from the dialog."""
        print(f"[Agent] Claim {claim_id} status changed to {new_status}")
        try:
            requests.post(
                f"http://localhost:8000/api/associate/{self.associate_id}/claims/{claim_id}/status",
                json={"status": new_status},
                timeout=2.0
            )
        except Exception as e:
            print(f"[Agent] Notice: Backend claim status update: {e}")

    def get_app_key(self, app_name: str, window_title: str) -> str:
        """
        Determines the distinct application/browser target identity.
        Returns empty string for ignored or transient system windows.
        """
        wt = (window_title or "").strip()
        app = (app_name or "").strip()
        lower_wt = wt.lower()
        lower_app = app.lower()

        # Ignore empty, desktop, alt-tab, and transient windows
        if not wt and not app:
            return ""
        if lower_app in ["desktop", "task switching"] or lower_wt in ["desktop", "task switching"]:
            return ""

        # Ignore the dialog itself
        if "claim work assistant" in lower_wt or "claim work assistant" in lower_app:
            return ""

        if any(term in lower_wt for term in ["quick settings", "new notification", "snap assist", "task view", "start menu"]):
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

                # Unique app target identity (e.g. "NovaArc RCM", "Bing (Edge)", "YouTube (Chrome)", "Excel", "Notepad", etc.)
                app_key = self.get_app_key(app_name, title)

                # Check for App Switch
                has_app_changed = (app_name != self.last_app) or (title != self.last_title)

                # 1. Update Claim Context
                active_claim, has_switched = self.claim_context.update_detected_claim(detected_claim)
                self.tray.update_claim(active_claim)

                # 1b. MANDATORY CLAIM WORK ASSISTANT TRIGGER WORKFLOW:
                # - Requirement 1: Dialogue box activates ONLY AFTER signin into NovaArc platform.
                # - Requirement 2: After signin into NovaArc platform, whenever user opens/switches to ANY app or application or browser, dialogue box triggers immediately.
                # - Requirement 3: Synchronous execution, no infinite re-triggering within seconds on the same app.
                if not self.dialog_open and not idle_status:
                    if not self.has_logged_in_to_office:
                        # PHASE 1: Pre-Authentication — Awaiting NovaArc login
                        if is_office:
                            if is_login_page:
                                self.has_seen_login_page = True
                                self.login_consecutive_non_login_ticks = 0
                                if self.sync_counter % 8 == 0:
                                    print(f"[*] NovaArc login page active ('{title[:35]}'). Awaiting employee sign-in...")
                            else:
                                if is_authenticated or (self.has_seen_login_page and not is_login_page):
                                    if not is_authenticated:
                                        self.login_consecutive_non_login_ticks += 1
                                    if is_authenticated or self.login_consecutive_non_login_ticks >= 2:
                                        # Employee has successfully signed in to NovaArc platform!
                                        self.has_logged_in_to_office = True
                                        self.office_platform_detected = True
                                        self.is_currently_on_platform = True
                                        print(f"\n[***] NOVAARC PLATFORM SIGN-IN CONFIRMED ('{title[:40]}')! [***]")
                                        print("[***] AGENT & AI ENABLED IMMEDIATELY! TRIGGERING CLAIM WORK ASSISTANT... [***]")
                                        self.emitter.enqueue({
                                            "associate_id": self.associate_id,
                                            "session_id": self.session_id,
                                            "claim_id": self.claim_context.get_current_claim_id(),
                                            "event_type": "OFFICE_SIGNIN_SUCCESS",
                                            "app_name": "NovaArc RCM",
                                            "window_title": title,
                                            "timestamp": now_iso,
                                            "is_idle": False,
                                            "agent_version": self.config["agent_version"]
                                        })
                                        self.emitter.flush()
                                        self.prompt_manual_claim(platform_name="NovaArc RCM", synchronous=True)
                                        self.last_handled_app_key = "NovaArc RCM"
                                        self.last_dialog_close_time = time.time()
                                        self.last_app = app_name
                                        self.last_title = title
                                        time.sleep(self.config["poll_interval_sec"])
                                        continue
                    else:
                        # PHASE 2: Post-Authentication — Platform Transition Triggers
                        # User requirement:
                        # 1. Trigger when user switches only from NovaArc platform to another app or browser (except TMS dashboard).
                        # 2. Trigger when user comes back to NovaArc platform from another app or browser.
                        # 3. Do NOT trigger when switching from an app to another app without visiting the platform.
                        is_tms = self.tracker.is_tms_dashboard(app_name, title)
                        now_t = time.time()

                        if is_tms:
                            # Target is TMS Dashboard: DO NOT TRIGGER ("except TMS dashboard")
                            pass
                        elif is_office:
                            # Target is NovaArc RCM platform!
                            # Did user come back to platform from an external app/browser?
                            if not self.is_currently_on_platform:
                                if (now_t - self.last_dialog_close_time) > 1.2:
                                    print(f"\n[*] RETURNED TO PLATFORM: Switched from external app back to NovaArc RCM. Popping Claim Work Assistant...")
                                    self.prompt_manual_claim(platform_name="NovaArc RCM", synchronous=True)
                                    self.is_currently_on_platform = True
                                    self.last_handled_app_key = "NovaArc RCM"
                                    self.last_dialog_close_time = time.time()
                                    self.last_app = app_name
                                    self.last_title = title
                                    time.sleep(self.config["poll_interval_sec"])
                                    continue
                            else:
                                self.is_currently_on_platform = True
                        else:
                            # Target is an External Application or Browser (YouTube, Excel, Bing, Notepad, etc.)
                            if app_key and app_key != "TMS Dashboard":
                                # Did user switch outward FROM the NovaArc platform to this external app?
                                if self.is_currently_on_platform:
                                    if (now_t - self.last_dialog_close_time) > 1.2:
                                        print(f"\n[*] PLATFORM OUTWARD SWITCH: Switched from NovaArc RCM to '{app_key}'. Popping Claim Work Assistant immediately...")
                                        self.prompt_manual_claim(platform_name=app_key, synchronous=True)
                                        self.is_currently_on_platform = False
                                        self.last_handled_app_key = app_key
                                        self.last_dialog_close_time = time.time()
                                        self.last_app = app_name
                                        self.last_title = title
                                        time.sleep(self.config["poll_interval_sec"])
                                        continue
                                else:
                                    # Switched between external apps without visiting NovaArc platform: DO NOT TRIGGER!
                                    self.is_currently_on_platform = False
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
                        "app_name": app_name,
                        "window_title": title,
                        "timestamp": now_iso,
                        "is_idle": idle_status,
                        "agent_version": self.config["agent_version"]
                    })

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
