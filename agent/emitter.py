import os
import json
import time
import threading
import requests
from typing import List, Dict, Any


class EventEmitter:
    """
    High-throughput non-blocking event emitter for desktop agents.
    Dispatches events asynchronously on background threads to ensure zero lag in the main monitoring loop.
    Provides persistent local file queue (.jsonl) fallback to guarantee zero data loss.
    """

    def __init__(
        self,
        backend_url: str,
        batch_size: int = 1,
        flush_interval_sec: float = 0.5,
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
        """Adds an event to the buffer and immediately flushes if threshold reached."""
        with self._lock:
            self.buffer.append(event)
            should_flush = len(self.buffer) >= self.batch_size or (time.time() - self.last_flush_time) >= self.flush_interval_sec
        if should_flush:
            self.flush()

    def flush(self):
        """Flushes the buffer and any offline queued items to the backend asynchronously."""
        with self._lock:
            offline_events = self._read_and_clear_queue()
            to_send = offline_events + self.buffer
            self.buffer = []
            self.last_flush_time = time.time()

        if not to_send:
            return

        # Always transmit on a background worker thread so the agent main loop never stalls
        threading.Thread(target=self._send_payload_async, args=(to_send,), daemon=True).start()

    def _send_payload_async(self, to_send: List[Dict[str, Any]]):
        urls = [self.backend_url]
        if "187.127.207.41" in self.backend_url:
            urls.append("https://frccind.com/tms-api/api/events")
            urls.append("http://localhost:8000/api/events")
            urls.append("http://127.0.0.1:8000/api/events")
        elif "localhost" in self.backend_url or "127.0.0.1" in self.backend_url:
            urls.append("http://187.127.207.41:8080/api/events")
            urls.append("https://frccind.com/tms-api/api/events")

        any_success = False
        for u in urls:
            try:
                resp = requests.post(
                    u,
                    json={"events": to_send},
                    timeout=2.0,
                    headers={"Content-Type": "application/json"}
                )
                if resp.status_code in (200, 201):
                    any_success = True
                    break
            except Exception:
                pass

        if not any_success:
            self._persist_to_queue(to_send)

    def _persist_to_queue(self, events: List[Dict[str, Any]]):
        try:
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
            os.remove(self.queue_file)
        except Exception:
            pass
        return events
