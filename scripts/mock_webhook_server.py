"""Lightweight Mock Webhook Listener Server.

Listens for incoming HTTP POST alert dispatches from Atlas Portfolio Intelligence on
http://127.0.0.1:8999/webhook.

Usage:
    python scripts/mock_webhook_server.py [port]
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 8999
RECEIVED_ALERTS: list[dict] = []


class WebhookHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length).decode("utf-8")
        try:
            payload = json.loads(body)
        except Exception:
            payload = {"raw_body": body}

        now = datetime.now(timezone.utc).strftime("%H:%M:%S ET")
        RECEIVED_ALERTS.append({"received_at": now, "payload": payload})

        print("\n========================================================")
        print(f"🔔 [MOCK WEBHOOK LISTENER] ALERT DISPATCH RECEIVED at {now}")
        print("--------------------------------------------------------")
        print(json.dumps(payload, indent=2))
        print("========================================================\n")

        response = json.dumps({"status": "received", "event_id": payload.get("event_id"), "timestamp": now}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(response)))
        self.end_headers()
        self.wfile.write(response)

    def do_GET(self):
        body = json.dumps({"status": "online", "received_count": len(RECEIVED_ALERTS), "alerts": RECEIVED_ALERTS}, indent=2).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        # Silence standard HTTP log spam for clean output
        pass


def run_server():
    server_address = ("127.0.0.1", PORT)
    httpd = HTTPServer(server_address, WebhookHandler)
    print(f"🚀 Mock Webhook Listener running on http://127.0.0.1:{PORT}/webhook")
    print("Press Ctrl+C to stop.\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Mock Webhook Listener.")
        httpd.server_close()


if __name__ == "__main__":
    run_server()
