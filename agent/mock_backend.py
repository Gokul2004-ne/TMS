import json
from http.server import HTTPServer, BaseHTTPRequestHandler


class MockBackendHandler(BaseHTTPRequestHandler):
    """Minimal standalone HTTP server for testing the desktop agent independently."""

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode("utf-8")
        
        try:
            data = json.loads(body)
        except Exception:
            data = {}

        if self.path == "/api/events":
            events = data.get("events", [])
            print(f"[MockBackend] Received {len(events)} events:")
            for ev in events[-3:]:
                print(f"  -> [{ev.get('timestamp')}] Claim: {ev.get('claim_id')} | App: {ev.get('app_name')} | Idle: {ev.get('is_idle')}")
            
            self.send_response(201)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"received": len(events), "status": "ok"}).encode())
            return

        elif self.path == "/api/sessions/start":
            print(f"[MockBackend] Session Started for: {data.get('associate_id')}")
            self.send_response(201)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"session_id": "mock-sess-101", "is_active": True}).encode())
            return

        elif self.path == "/api/sessions/end":
            print(f"[MockBackend] Session Ended: {data.get('session_id')}")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ended"}).encode())
            return

        self.send_response(404)
        self.end_headers()

    def log_message(self, format, *args):
        # Suppress default request logs
        return


def run_mock_server(port=8000):
    server = HTTPServer(("0.0.0.0", port), MockBackendHandler)
    print(f"[MockBackend] Listening on http://localhost:{port}")
    print("Ready to receive desktop agent events...")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[MockBackend] Stopped.")


if __name__ == "__main__":
    run_mock_server()
