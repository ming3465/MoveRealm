"""Clients for the two production surfaces the agent can probe.

``ContractGate`` speaks to the Node bridge and therefore to the *real* Zod contracts. Nothing in
this package re-implements a gate; a rejection here is a rejection the shipped product would make.

``DirectorHttpClient`` speaks to a running Express adapter for the live audit mode.
"""

from __future__ import annotations

import json
import os
import queue
import shutil
import subprocess
import threading
import time
import urllib.error
import urllib.request
from collections import deque
from pathlib import Path
from typing import Any

from .types import Verdict

BRIDGE_RELATIVE = Path("agent") / "bridge" / "contract_bridge.ts"
_EOF = object()


class GateUnavailable(RuntimeError):
    """The gate could not be reached at all. Probes become inconclusive, never 'defended'."""


def _resolve_runner(repo_root: Path) -> list[str]:
    local = repo_root / "node_modules" / ".bin" / "tsx"
    if local.exists():
        return [str(local)]
    system = shutil.which("tsx")
    if system:
        return [system]
    if shutil.which("npx"):
        return ["npx", "--no-install", "tsx"]
    raise GateUnavailable(
        "tsx was not found. Run `npm install` in the repository root so the contract bridge can start."
    )


class ContractGate:
    """A long-lived `tsx` subprocess exposing the production safety gates over stdio."""

    kind = "production-contracts"

    def __init__(
        self,
        repo_root: Path,
        timeout_s: float = 30.0,
        startup_timeout_s: float = 120.0,
    ) -> None:
        self.repo_root = repo_root
        self.timeout_s = timeout_s
        self.startup_timeout_s = startup_timeout_s
        self.script = repo_root / BRIDGE_RELATIVE
        self._process: subprocess.Popen[str] | None = None
        self._lines: queue.Queue[Any] = queue.Queue()
        self._stderr: deque[str] = deque(maxlen=25)
        self._sequence = 0
        self.info: dict[str, Any] = {}

    # -- lifecycle -----------------------------------------------------------------------------

    def __enter__(self) -> "ContractGate":
        self.start()
        return self

    def __exit__(self, *_exc: object) -> None:
        self.close()

    def start(self) -> None:
        if self._process is not None:
            return
        if not self.script.exists():
            raise GateUnavailable(f"The contract bridge is missing at {self.script}.")

        command = [*_resolve_runner(self.repo_root), str(self.script)]
        environment = {**os.environ, "NODE_NO_WARNINGS": "1"}
        try:
            self._process = subprocess.Popen(  # noqa: S603 - fixed local command
                command,
                cwd=str(self.repo_root),
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,
                env=environment,
            )
        except OSError as error:  # pragma: no cover - depends on the host
            raise GateUnavailable(f"The contract bridge could not start: {error}") from error

        threading.Thread(target=self._pump_stdout, daemon=True).start()
        threading.Thread(target=self._pump_stderr, daemon=True).start()

        response = self._call("ping", {}, timeout_s=self.startup_timeout_s)
        self.info = {key: value for key, value in response.items() if key not in ("id", "ok", "kind")}

    def close(self) -> None:
        process = self._process
        self._process = None
        if process is None:
            return
        try:
            if process.stdin and not process.stdin.closed:
                process.stdin.close()
            process.wait(timeout=5)
        except (subprocess.TimeoutExpired, OSError):
            process.kill()
        finally:
            for stream in (process.stdout, process.stderr):
                if stream and not stream.closed:
                    stream.close()

    # -- plumbing ------------------------------------------------------------------------------

    def _pump_stdout(self) -> None:
        process = self._process
        if process is None or process.stdout is None:
            return
        for line in process.stdout:
            self._lines.put(line)
        self._lines.put(_EOF)

    def _pump_stderr(self) -> None:
        process = self._process
        if process is None or process.stderr is None:
            return
        for line in process.stderr:
            stripped = line.rstrip()
            if stripped:
                self._stderr.append(stripped)

    def _diagnostics(self) -> str:
        return " | ".join(list(self._stderr)[-4:]) or "no bridge diagnostics were captured"

    def _call(self, op: str, payload: dict[str, Any], timeout_s: float | None = None) -> dict[str, Any]:
        process = self._process
        if process is None or process.stdin is None:
            raise GateUnavailable("The contract bridge is not running.")

        self._sequence += 1
        request_id = str(self._sequence)
        deadline = time.monotonic() + (timeout_s or self.timeout_s)

        try:
            process.stdin.write(json.dumps({"id": request_id, "op": op, "payload": payload}) + "\n")
            process.stdin.flush()
        except (BrokenPipeError, ValueError) as error:
            raise GateUnavailable(f"The contract bridge closed its input: {self._diagnostics()}") from error

        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise GateUnavailable(f"The contract bridge timed out on {op}: {self._diagnostics()}")
            try:
                line = self._lines.get(timeout=remaining)
            except queue.Empty:
                continue
            if line is _EOF:
                raise GateUnavailable(f"The contract bridge exited: {self._diagnostics()}")
            try:
                message = json.loads(line)
            except json.JSONDecodeError:
                continue
            if message.get("id") == request_id:
                return message

    # -- gate operations -----------------------------------------------------------------------

    def validate(self, surface: str, candidate: Any, request: dict[str, Any] | None = None) -> Verdict:
        payload: dict[str, Any] = {"candidate": candidate}
        if request is not None:
            payload["request"] = request
        started = time.perf_counter()
        try:
            message = self._call(f"{surface}.validate", payload)
        except GateUnavailable as error:
            return Verdict(False, "transport", str(error), (), (time.perf_counter() - started) * 1000)

        latency_ms = (time.perf_counter() - started) * 1000
        if message.get("ok"):
            return Verdict(True, "accepted", "", (), latency_ms)
        return Verdict(
            False,
            str(message.get("kind", "internal")),
            str(message.get("error", "")),
            tuple(message.get("issues") or ()),
            latency_ms,
        )

    def production_fallback(self, surface: str, request: dict[str, Any]) -> dict[str, Any] | None:
        """Ask the shipped deterministic fallback for its own answer to this request."""
        message = self._call(f"{surface}.fallback", {"request": request})
        return message.get("data") if message.get("ok") else None

    def demo_scenes(self) -> dict[str, Any]:
        message = self._call("scene.demo", {})
        return message.get("data", {}) if message.get("ok") else {}


class DirectorHttpClient:
    """Minimal client for the running Movement Director adapter."""

    kind = "http-adapter"

    def __init__(self, base_url: str, timeout_s: float = 30.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout_s = timeout_s

    def _post(self, path: str, body: dict[str, Any]) -> tuple[int, dict[str, Any], float]:
        request = urllib.request.Request(
            f"{self.base_url}{path}",
            data=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        started = time.perf_counter()
        try:
            with urllib.request.urlopen(request, timeout=self.timeout_s) as response:  # noqa: S310 - local URL
                payload = json.loads(response.read().decode("utf-8") or "{}")
                return response.status, payload, (time.perf_counter() - started) * 1000
        except urllib.error.HTTPError as error:
            raw = error.read().decode("utf-8") or "{}"
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                payload = {"error": raw[:200]}
            return error.code, payload, (time.perf_counter() - started) * 1000
        except (urllib.error.URLError, TimeoutError, ConnectionError) as error:
            raise GateUnavailable(f"The Movement Director adapter is unreachable at {self.base_url}: {error}") from error

    def health(self) -> dict[str, Any]:
        request = urllib.request.Request(f"{self.base_url}/api/health", method="GET")
        try:
            with urllib.request.urlopen(request, timeout=self.timeout_s) as response:  # noqa: S310 - local URL
                return json.loads(response.read().decode("utf-8") or "{}")
        except (urllib.error.URLError, TimeoutError, ConnectionError, json.JSONDecodeError) as error:
            raise GateUnavailable(f"The Movement Director adapter is unreachable at {self.base_url}: {error}") from error

    def plan(self, request: dict[str, Any]) -> tuple[int, dict[str, Any], float]:
        return self._post("/api/quest/plan", request)

    def adapt(self, request: dict[str, Any]) -> tuple[int, dict[str, Any], float]:
        return self._post("/api/quest/adapt", request)
