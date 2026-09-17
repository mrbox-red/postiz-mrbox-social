#!/usr/bin/env python3
"""Viral Starz - ponte tra il backend Postiz (in Docker) e Claude Code sull'host.

Riceve POST /run con {system, prompt, resume?} e lancia `claude -p` senza strumenti,
una richiesta alla volta. Il token Claude resta sull'host: il container non lo vede mai.
"""
import json
import os
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BIND = os.environ.get("BRIDGE_BIND", "172.17.0.1")
PORT = int(os.environ.get("BRIDGE_PORT", "8790"))
TOKEN = os.environ.get("BRIDGE_TOKEN", "")
CLAUDE_BIN = os.environ.get("CLAUDE_BIN", "claude")
MODEL = os.environ.get("CLAUDE_MODEL", "claude-opus-5")
WORKDIR = os.environ.get("BRIDGE_WORKDIR", os.getcwd())
TIMEOUT = int(os.environ.get("BRIDGE_TIMEOUT", "600"))
MAX_BODY = 2 * 1024 * 1024

# Claude Code occupa RAM: sul server da 4 GB gira un report alla volta.
run_lock = threading.Lock()


def run_claude(system: str, prompt: str, resume: str | None):
    args = [
        CLAUDE_BIN, "-p",
        "--model", MODEL,
        "--output-format", "json",
        "--tools", "",
        "--setting-sources", "",
        "--strict-mcp-config",
        "--system-prompt", system,
    ]
    if resume:
        args += ["--resume", resume]
    started = time.time()
    with run_lock:
        proc = subprocess.run(
            args, input=prompt, capture_output=True, text=True,
            timeout=TIMEOUT, cwd=WORKDIR,
        )
    elapsed = int((time.time() - started) * 1000)
    try:
        out = json.loads(proc.stdout)
    except json.JSONDecodeError:
        return 502, {"ok": False, "error": "claude_output", "detail": (proc.stderr or proc.stdout)[-800:]}
    if out.get("is_error") or proc.returncode != 0:
        return 502, {"ok": False, "error": "claude_error", "detail": str(out.get("result", ""))[-800:]}
    return 200, {"ok": True, "text": out.get("result", ""), "sessionId": out.get("session_id"), "durationMs": elapsed}


class Handler(BaseHTTPRequestHandler):
    def _send(self, code: int, body: dict):
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _authorized(self) -> bool:
        return bool(TOKEN) and self.headers.get("X-Bridge-Token") == TOKEN

    def do_GET(self):
        if self.path != "/health":
            return self._send(404, {"ok": False})
        if not self._authorized():
            return self._send(401, {"ok": False})
        self._send(200, {"ok": True, "busy": run_lock.locked(), "model": MODEL})

    def do_POST(self):
        if self.path != "/run":
            return self._send(404, {"ok": False})
        if not self._authorized():
            return self._send(401, {"ok": False})
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BODY:
            return self._send(400, {"ok": False, "error": "body"})
        try:
            body = json.loads(self.rfile.read(length))
            system, prompt = str(body["system"]), str(body["prompt"])
            resume = body.get("resume") or None
        except (json.JSONDecodeError, KeyError, TypeError):
            return self._send(400, {"ok": False, "error": "body"})
        try:
            code, res = run_claude(system, prompt, resume)
        except subprocess.TimeoutExpired:
            code, res = 504, {"ok": False, "error": "timeout"}
        self._send(code, res)

    def log_message(self, fmt, *args):
        print("%s %s" % (self.address_string(), fmt % args), flush=True)


if __name__ == "__main__":
    if not TOKEN:
        raise SystemExit("BRIDGE_TOKEN mancante")
    ThreadingHTTPServer((BIND, PORT), Handler).serve_forever()
