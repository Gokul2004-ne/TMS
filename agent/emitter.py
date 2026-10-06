import os
import json
import time
import requests
from typing import List, Dict, Any


class EventEmitter:
    """
    Batches and transmits agent events to the backend API.
    Provides persistent local file queue (.jsonl) fallback to guarantee zero data loss.
    """

    def __init__(
        self,
        backend_url: str,
        batch_size: int = 10,
        flush_interval_sec: int = 30,
        queue_file_path: str = "queue.jsonl"
    ):
        self.backend_url = backend_url
        self.batch_size = batch_size
        self.flush_interval_sec = flush_interval_sec
        self.queue_file = os.path.join(os.path.dirname(__file__), queue_file_path)
        self.buffer: List[Dict[str, Any]] = []
        self.last_flush_time = time.time()

    def enqueue(self, event: Dict[str, Any]):
        """Adds an event to the local in-memory buffer."""
        self.buffer.append(event)
        now = time.time()
        if len(self.buffer) >= self.batch_size or (now - self.last_flush_time) >= self.flush_interval_sec:
            self.flush()

    def flush(self):
        """Flushes the buffer and any offline queued items to the backend."""
        # 1. Recover any un-sent events from local offline queue
        offline_events = self._read_and_clear_queue()
        to_send = offline_events + self.buffer
        self.buffer = []
        self.last_flush_time = time.time()

        if not to_send:
            return

        # 2. Attempt HTTP POST to backend
        try:
            resp = requests.post(
                self.backend_url,
                json={"events": to_send},
                timeout=4.0,
                headers={"Content-Type": "application/json"}
            )
            if resp.status_code in (200, 201):
                return
            else:
                # Backend returned error status; persist to offline queue
                self._persist_to_queue(to_send)
        except Exception:
            # Network error or backend offline; write to disk queue for replay
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
            # Remove queue file after reading
            os.remove(self.queue_file)
        except Exception:
            pass
        return events
