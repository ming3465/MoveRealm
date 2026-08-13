#!/usr/bin/env python3
"""A small local agent that reviews MoveRealm candidates without owning safety.

The agent uses the production TypeScript evaluator as an authoritative tool, then
optionally asks a local Ollama vision model for an advisory quality score. If the
primary candidate fails deterministic gates, it can evaluate and select a supplied
validated fallback. Model output can never turn an ineligible candidate into a pass.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Mapping, Sequence
from urllib.parse import urlparse


DEFAULT_MODEL = "qwen3-vl:4b-instruct-q4_K_M"
PROJECT_ROOT = Path(__file__).resolve().parents[1]
SHA256_PATTERN = re.compile(r"^[a-f0-9]{64}$")
FIXTURE_IMAGE_PATTERN = re.compile(r"^assets/room-fixtures/[a-z0-9-]+\.png$")


class AgentToolError(RuntimeError):
    """Raised when an agent tool cannot produce a trustworthy structured result."""


Report = dict[str, Any]
Evaluator = Callable[[Path, str, str, str, bool], Report]


def _require_mapping(value: Any, label: str) -> Mapping[str, Any]:
    if not isinstance(value, dict):
        raise AgentToolError(f"Evaluator report is missing {label}.")
    return value


def _require_loopback_ollama_url(value: str) -> str:
    """Reject any judge URL that could send a fixture image off-device."""

    try:
        parsed = urlparse(value)
        hostname = parsed.hostname
        parsed.port
    except (TypeError, ValueError) as error:
        raise AgentToolError("The Ollama URL is invalid.") from error
    if (
        parsed.scheme != "http"
        or hostname not in {"127.0.0.1", "localhost", "::1"}
        or parsed.username is not None
        or parsed.password is not None
        or parsed.path not in {"", "/"}
        or parsed.params
        or parsed.query
        or parsed.fragment
    ):
        raise AgentToolError("The Ollama URL must be a plain loopback HTTP origin.")
    return value.rstrip("/")


def _git_output(project_root: Path, *arguments: str) -> bytes | None:
    try:
        completed = subprocess.run(
            ["git", *arguments],
            cwd=project_root,
            capture_output=True,
            check=False,
            timeout=10,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    return completed.stdout if completed.returncode == 0 else None


def repository_provenance(project_root: Path = PROJECT_ROOT) -> dict[str, Any]:
    """Identify the committed tree and disclose dirty state without retaining file names."""

    commit_raw = _git_output(project_root, "rev-parse", "HEAD")
    tree_raw = _git_output(project_root, "rev-parse", "HEAD^{tree}")
    status = _git_output(
        project_root,
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
    )
    commit = commit_raw.decode("ascii", errors="ignore").strip() if commit_raw else ""
    tree = tree_raw.decode("ascii", errors="ignore").strip() if tree_raw else ""
    entries = [line for line in status.splitlines() if line] if status is not None else None
    return {
        "commit": commit if len(commit) == 40 else None,
        "headTree": tree if len(tree) == 40 else None,
        "dirty": bool(entries) if entries is not None else None,
        "statusEntryCount": len(entries) if entries is not None else None,
        "statusSha256": hashlib.sha256(status).hexdigest() if status is not None else None,
    }


@dataclass(frozen=True)
class CandidateSnapshot:
    serialized: bytes
    input_sha256: str
    fixture_id: str
    context_sha256: str


def _candidate_snapshot(candidate: Path, project_root: Path) -> CandidateSnapshot:
    """Read one immutable candidate view and verify its frozen fixture before judging."""

    try:
        serialized = candidate.read_bytes()
        parsed = _require_mapping(
            json.loads(serialized.decode("utf-8")),
            "candidate root object",
        )
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise AgentToolError("Candidate JSON was unreadable.") from error

    fixture_id = parsed.get("fixtureId")
    if not isinstance(fixture_id, str) or not fixture_id:
        raise AgentToolError("Candidate JSON has no fixture ID.")
    scene = _require_mapping(parsed.get("scene"), "candidate scene")
    plan_request = _require_mapping(parsed.get("planRequest"), "candidate plan request")
    context = {
        "fixtureId": fixture_id,
        "scene": scene,
        "planRequest": plan_request,
    }
    context_bytes = json.dumps(
        context,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")

    manifest_path = project_root / "eval" / "fixtures.json"
    try:
        manifest = _require_mapping(
            json.loads(manifest_path.read_text(encoding="utf-8")),
            "fixture manifest",
        )
    except (OSError, json.JSONDecodeError) as error:
        raise AgentToolError("Fixture manifest was unreadable.") from error
    fixtures = manifest.get("fixtures")
    if not isinstance(fixtures, list):
        raise AgentToolError("Fixture manifest has no fixture list.")
    fixture = next(
        (
            item
            for item in fixtures
            if isinstance(item, dict) and item.get("id") == fixture_id
        ),
        None,
    )
    if fixture is None:
        raise AgentToolError(f"No fixture oracle exists for {fixture_id}.")
    image_relative = fixture.get("image")
    expected_digest = fixture.get("sha256")
    if (
        not isinstance(image_relative, str)
        or FIXTURE_IMAGE_PATTERN.fullmatch(image_relative) is None
        or not isinstance(expected_digest, str)
        or SHA256_PATTERN.fullmatch(expected_digest) is None
    ):
        raise AgentToolError("Fixture oracle has an invalid image or digest.")
    image_path = (project_root / image_relative).resolve()
    try:
        image_path.relative_to(project_root.resolve())
        image_digest = hashlib.sha256(image_path.read_bytes()).hexdigest()
    except (OSError, ValueError) as error:
        raise AgentToolError("Fixture image was unreadable.") from error
    if image_digest != expected_digest:
        raise AgentToolError("Fixture image failed its integrity check; judge was not contacted.")

    return CandidateSnapshot(
        serialized=serialized,
        input_sha256=hashlib.sha256(serialized).hexdigest(),
        fixture_id=fixture_id,
        context_sha256=hashlib.sha256(context_bytes).hexdigest(),
    )


def validate_report(report: Any) -> Report:
    root = dict(_require_mapping(report, "root object"))
    if root.get("schemaVersion") != "1.0.0":
        raise AgentToolError("Evaluator report has an unsupported schema version.")
    deterministic = _require_mapping(root.get("deterministic"), "deterministic result")
    totals = _require_mapping(root.get("totals"), "eligibility totals")
    judge = _require_mapping(root.get("judge"), "judge result")
    if not isinstance(deterministic.get("passed"), bool):
        raise AgentToolError("Evaluator report has no deterministic pass state.")
    if not isinstance(totals.get("eligible"), bool):
        raise AgentToolError("Evaluator report has no eligibility state.")
    if totals["eligible"] != deterministic["passed"]:
        raise AgentToolError("Evaluator eligibility contradicts its deterministic gates.")
    if judge.get("status") not in {"scored", "not_run", "invalid"}:
        raise AgentToolError("Evaluator report has an invalid judge status.")
    if not isinstance(root.get("fixtureId"), str) or not root["fixtureId"]:
        raise AgentToolError("Evaluator report has no fixture ID.")
    return root


@dataclass(frozen=True)
class SubprocessEvaluator:
    """Tool adapter for the repository's authoritative evaluator."""

    project_root: Path = PROJECT_ROOT
    timeout_seconds: int = 240

    def __call__(
        self,
        candidate: Path,
        judge_mode: str,
        model: str,
        ollama_url: str,
        strict_judge: bool,
    ) -> Report:
        candidate_path = candidate.expanduser().resolve()
        if not candidate_path.is_file():
            raise AgentToolError("Candidate JSON does not exist.")
        if judge_mode == "ollama":
            ollama_url = _require_loopback_ollama_url(ollama_url)
        snapshot = _candidate_snapshot(candidate_path, self.project_root)

        with tempfile.TemporaryDirectory(prefix="moverealm-python-agent-") as directory:
            snapshot_path = Path(directory) / "candidate.json"
            snapshot_path.write_bytes(snapshot.serialized)
            report_path = Path(directory) / "report.json"
            command = [
                "npm",
                "run",
                "eval",
                "--",
                "--input",
                str(snapshot_path),
                "--judge",
                judge_mode,
                "--model",
                model,
                "--ollama-url",
                ollama_url,
                "--out",
                str(report_path),
            ]
            if strict_judge:
                command.append("--strict-judge")
            try:
                completed = subprocess.run(
                    command,
                    cwd=self.project_root,
                    capture_output=True,
                    check=False,
                    text=True,
                    timeout=self.timeout_seconds,
                )
            except subprocess.TimeoutExpired as error:
                raise AgentToolError("Authoritative evaluator timed out.") from error
            except OSError as error:
                raise AgentToolError("Authoritative evaluator could not start.") from error

            # A hard-gate failure intentionally exits non-zero after writing a valid
            # report. Trust the schema and eligibility, never the process code alone.
            if not report_path.is_file():
                raise AgentToolError(
                    f"Authoritative evaluator produced no report (exit {completed.returncode})."
                )
            try:
                report = json.loads(report_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError) as error:
                raise AgentToolError("Authoritative evaluator report was unreadable.") from error
            validated = validate_report(report)
            if validated.get("inputSha256") != snapshot.input_sha256:
                raise AgentToolError("Evaluator report does not match the candidate bytes it received.")
            if validated["fixtureId"] != snapshot.fixture_id:
                raise AgentToolError("Evaluator report does not match the candidate fixture.")
            validated["candidateContextSha256"] = snapshot.context_sha256
            return validated


def summarize_report(report: Report) -> dict[str, Any]:
    """Keep only bounded, non-prose evidence; never retain a raw model response."""

    totals = _require_mapping(report["totals"], "eligibility totals")
    judge = _require_mapping(report["judge"], "judge result")
    deterministic = _require_mapping(report["deterministic"], "deterministic result")
    context_sha256 = report.get("candidateContextSha256")
    if not isinstance(context_sha256, str) or SHA256_PATTERN.fullmatch(context_sha256) is None:
        raise AgentToolError("Evaluator report has no trustworthy candidate context digest.")
    return {
        "observedAt": report.get("observedAt"),
        "fixtureId": report["fixtureId"],
        "source": report.get("source"),
        "inputSha256": report.get("inputSha256"),
        "candidateContextSha256": context_sha256,
        "hardGatesPassed": deterministic["passed"],
        "eligible": totals["eligible"],
        "judgeStatus": judge["status"],
        "advisoryEarned": totals.get("advisoryEarned"),
        "advisoryPossible": totals.get("advisoryPossible"),
        "modelDigest": judge.get("modelDigest"),
        "judgeLatencyMs": judge.get("latencyMs"),
    }


class MoveRealmPythonAgent:
    """Observe, evaluate, recover, and verify a frozen MoveRealm candidate."""

    def __init__(self, evaluator: Evaluator | None = None) -> None:
        self._evaluator = evaluator or SubprocessEvaluator()

    def run(
        self,
        candidate: Path,
        *,
        fallback_candidate: Path | None = None,
        judge_mode: str = "ollama",
        model: str = DEFAULT_MODEL,
        ollama_url: str = "http://127.0.0.1:11434",
        strict_judge: bool = False,
    ) -> dict[str, Any]:
        if judge_mode not in {"none", "ollama"}:
            raise AgentToolError("judge_mode must be none or ollama.")
        if strict_judge and judge_mode != "ollama":
            raise AgentToolError("strict_judge requires the ollama judge mode.")
        if judge_mode == "ollama":
            ollama_url = _require_loopback_ollama_url(ollama_url)

        trace: list[dict[str, str]] = []
        primary = self._evaluator(
            candidate, judge_mode, model, ollama_url, strict_judge
        )
        primary_summary = summarize_report(primary)
        trace.append(
            {
                "step": "observe",
                "status": "complete",
                "detail": f"Loaded frozen fixture {primary_summary['fixtureId']}.",
            }
        )
        trace.append(
            {
                "step": "evaluate_primary",
                "status": "pass" if primary_summary["eligible"] else "fail",
                "detail": "Deterministic production gates evaluated before advisory quality.",
            }
        )

        evaluations = [primary_summary]
        chosen = primary_summary
        decision = "accept_candidate" if primary_summary["eligible"] else "reject_candidate"

        if not primary_summary["eligible"] and fallback_candidate is not None:
            trace.append(
                {
                    "step": "recover",
                    "status": "started",
                    "detail": "Primary failed closed; evaluating the supplied fallback.",
                }
            )
            fallback = self._evaluator(
                fallback_candidate, judge_mode, model, ollama_url, strict_judge
            )
            fallback_summary = summarize_report(fallback)
            if fallback_summary["fixtureId"] != primary_summary["fixtureId"]:
                raise AgentToolError("Fallback fixture does not match the primary fixture.")
            if (
                fallback_summary.get("candidateContextSha256")
                != primary_summary.get("candidateContextSha256")
            ):
                raise AgentToolError(
                    "Fallback room, constraints, or user intent do not match the primary candidate."
                )
            if fallback_summary.get("source") != "fallback":
                raise AgentToolError("Recovery candidate is not labelled as a fallback.")
            evaluations.append(fallback_summary)
            if fallback_summary["eligible"]:
                chosen = fallback_summary
                decision = "use_validated_fallback"
                trace.append(
                    {
                        "step": "recover",
                        "status": "pass",
                        "detail": "Fallback passed the same authoritative gates.",
                    }
                )
            else:
                trace.append(
                    {
                        "step": "recover",
                        "status": "fail",
                        "detail": "Fallback also failed closed; no candidate was selected.",
                    }
                )

        selected = decision in {"accept_candidate", "use_validated_fallback"}
        judge_ready = judge_mode == "none" or all(
            item["judgeStatus"] == "scored" for item in evaluations
        )
        complete = selected and (judge_ready or not strict_judge)
        trace.append(
            {
                "step": "verify",
                "status": "pass" if complete else "fail",
                "detail": (
                    "Selected output remains eligible after the complete tool loop."
                    if complete
                    else "No fully verified eligible output is available."
                ),
            }
        )

        return {
            "schemaVersion": "1.0.0",
            "repository": repository_provenance(),
            "agent": {
                "name": "MoveRealm Python Shadow Agent",
                "runtime": "python-stdlib",
                "judgeMode": judge_mode,
                "model": model if judge_mode == "ollama" else None,
                "safetyAuthority": "deterministic-production-gates",
                "modelRole": "advisory-only",
            },
            "decision": decision,
            "complete": complete,
            "chosen": chosen if selected else None,
            "evaluations": evaluations,
            "trace": trace,
            "rawModelOutputRetained": False,
        }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Evaluate a MoveRealm candidate with hard gates and an optional cheap local VLM."
    )
    parser.add_argument("--candidate", required=True, type=Path)
    parser.add_argument("--fallback-candidate", type=Path)
    parser.add_argument("--judge", choices=("none", "ollama"), default="ollama")
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--ollama-url", default="http://127.0.0.1:11434")
    parser.add_argument("--strict-judge", action="store_true")
    parser.add_argument("--out", type=Path)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    arguments = build_parser().parse_args(argv)
    try:
        result = MoveRealmPythonAgent().run(
            arguments.candidate,
            fallback_candidate=arguments.fallback_candidate,
            judge_mode=arguments.judge,
            model=arguments.model,
            ollama_url=arguments.ollama_url,
            strict_judge=arguments.strict_judge,
        )
    except AgentToolError as error:
        print(json.dumps({"ok": False, "error": str(error)}, indent=2), file=sys.stderr)
        return 2

    serialized = f"{json.dumps(result, indent=2)}\n"
    if arguments.out:
        arguments.out.parent.mkdir(parents=True, exist_ok=True)
        arguments.out.write_text(serialized, encoding="utf-8")
    sys.stdout.write(serialized)
    return 0 if result["complete"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
