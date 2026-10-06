import os
import sys
import json
import time
import uuid
import signal
from datetime import datetime
import requests

from tracker import WindowTracker
from idle_monitor import IdleMonitor
from claim_context import ClaimContextManager
from emitter import EventEmitter


def load_config() -> dict:
    default_config = {
        "associate_id": "EMP101",
        "backend_url": "http://localhost:8000/api/events",
        "session_start_url": "http://localhost:8000/api/sessions/start",
        "session_end_url": "http://localhost:8000/api/sessions/end",
        "poll_interval_sec": 3,
        "idle_threshold_sec": 60,
        "claim_regex": "CLM\\d{4,8}",
        "batch_size": 10,
        "flush_interval_sec": 30,
        "agent_version": "1.0.0"
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

    def __init__(self):
        self.config = load_config()
        self.associate_id = self.config["associate_id"]
        self.session_id = f"sess-{uuid.uuid4().hex[:8]}"
        self.running = False

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
            "timestamp": datetime.utcnow().isoformat() + "Z",
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
            "timestamp": datetime.utcnow().isoformat() + "Z",
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

        print(f"[Agent] Running! Polling foreground window every {self.config['poll_interval_sec']}s...")
        print("Press Ctrl+C to terminate.")

        def handle_sigint(sig, frame):
            self.stop_session()
            sys.exit(0)

        signal.signal(signal.SIGINT, handle_sigint)

        try:
            while self.running:
                now_iso = datetime.utcnow().isoformat() + "Z"
                app_name, title, detected_claim = self.tracker.get_active_window()
                idle_status = self.idle_monitor.is_idle()
                idle_transition = self.idle_monitor.check_idle_transition()

                # 1. Update Claim Context
                active_claim, has_switched = self.claim_context.update_detected_claim(detected_claim)

                # 2. Check for Claim Switch Event
                if has_switched:
                    print(f"[*] NEW CLAIM DETECTED: {active_claim} (Window: '{title[:40]}...')")
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

                # 3. Check for Idle Transitions
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

                # 4. Check for App Switch or Heartbeat
                has_app_changed = (app_name != self.last_app) or (title != self.last_title)
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
