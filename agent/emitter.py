import os
import json
import time
import threading
import requests
from typing import List, Dict, Any


class EventEmitter:
    """
    Batches and transmits agent events to the backend API asynchronously.
    Provides persistent local file queue (.jsonl) fallback to guarantee zero data loss.
    """

    def __init__(
        self,
        backend_url: str,
        batch_size: int = 5,
        flush_interval_sec: int = 3,
        queue_file_path: str = "queue.jsonl"
    ):
        self.backend_url = backend_url
        self.batch_size = batch_size
        self.flush_interval_sec = flush_interval_sec
        self.queue_file = os.path.join(os.path.dirname(__file__), queue_file_path)
        self.buffer: List[Dict[str, Any]] = []
        self.last_flush_time = time.time()
        self._lock = threading.Lock()

    def enqueue(self, event: Dict[str, Any]):
        """Adds an event to the local in-memory buffer and flushes when ready."""
        with self._lock:
            self.buffer.append(event)
            now = time.time()
            should_flush = len(self.buffer) >= self.batch_size or (now - self.last_flush_time) >= self.flush_interval_sec
        if should_flush:
            self.flush()

    def flush(self, synchronous: bool = False):
        """Flushes the buffer and any offline queued items to the backend."""
        with self._lock:
            offline_events = self._read_and_clear_queue()
            to_send = offline_events + self.buffer
            self.buffer = []
            self.last_flush_time = time.time()

        if not to_send:
            return

        if synchronous:
            self._send_payload(to_send)
        else:
            threading.Thread(target=self._send_payload, args=(to_send,), daemon=True).start()

    def _send_payload(self, to_send: List[Dict[str, Any]]):
        # Always prioritize Live Cloud DB (HTTPS primary -> IP failover); only send once on first success
        urls = [
            self.backend_url,
            "https://frccind.com/tms-api/api/events",
            "http://187.127.207.41:8080/api/events",
        ]
        if os.getenv("TMS_USE_LOCAL") == "1":
            urls = ["http://127.0.0.1:8000/api/events"] + urls

        any_success = False
        for u in dict.fromkeys(urls):
            try:
                resp = requests.post(
                    u,
                    json={"events": to_send},
                    timeout=3.5,
                    headers={
                        "Content-Type": "application/json",
                        "User-Agent": "TMS-Desktop-Agent/1.0.3"
                    }
                )
                if resp.status_code in (200, 201):
                    data = resp.json() if resp.content else {}
                    if data.get("status") != "fallback_ok":
                        any_success = True
                        break
            except Exception:
                pass

        if not any_success:
            self._persist_to_queue(to_send)

    def _persist_to_queue(self, events: List[Dict[str, Any]]):
        try:
            with self._lock:
                with open(self.queue_file, "a", encoding="utf-8") as f:
                    for ev in events:
                        f.write(json.dumps(ev) + "\n")
        except Exception as e:
            print(f"[EventEmitter] Error persisting to disk queue: {e}")

    def _read_and_clear_queue(self) -> List[Dict[str, Any]]:
        if not os.path.exists(self.queue_file):
            return []
        events = []
        try:
            with open(self.queue_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line:
                        events.append(json.loads(line))
            # Remove queue file after reading
            os.remove(self.queue_file)
        except Exception:
            pass
        return events
