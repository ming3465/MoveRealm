"""Command line entry point."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from . import __version__
from .agent import ProbeRun, SafetyProbeAgent
from .fixtures import WORLDS, WORLDS_BY_NAME
from .gate import ContractGate, DirectorHttpClient, GateUnavailable
from .live import LiveRun, audit_live
from .planner import DeterministicPlanner, OllamaPlanner
from .report import build_report, render_console, write_outputs

EXIT_CLEAN = 0
EXIT_FINDINGS = 1
EXIT_UNAVAILABLE = 2

DEFAULT_BASE_URL = "http://127.0.0.1:4173"
DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434"
DEFAULT_MODEL = "qwen3-vl:8b-instruct-q4_K_M"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="moverealm-safety-probe",
        description=(
            "Adversarially probe MoveRealm's Movement Director safety contracts and report any "
            "candidate the documented rules refuse but the production gate accepts."
        ),
    )
    parser.add_argument(
        "--mode",
        choices=("contracts", "live", "both"),
        default="contracts",
        help="contracts: attack the production Zod gates directly. live: audit a running adapter.",
    )
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="Movement Director adapter URL for live mode.")
    parser.add_argument(
        "--worlds",
        default="all",
        help=f"Comma-separated rooms to probe. Available: {', '.join(WORLDS_BY_NAME)}.",
    )
    parser.add_argument(
        "--planner",
        choices=("deterministic", "ollama"),
        default="deterministic",
        help="ollama adds local model-proposed mutations; it never downloads a model.",
    )
    parser.add_argument("--model", default=DEFAULT_MODEL, help="Local model name for --planner ollama.")
    parser.add_argument("--ollama-url", default=DEFAULT_OLLAMA_URL)
    parser.add_argument("--max-rounds", type=int, default=8)
    parser.add_argument("--quiet-rounds", type=int, default=2, help="Stop after this many rounds with nothing new.")
    parser.add_argument("--no-boundaries", action="store_true", help="Skip the frontier measurement phase.")
    parser.add_argument("--out-dir", type=Path, help="Write safety-probe.json and safety-probe.md here.")
    parser.add_argument("--json", action="store_true", help="Print the full report as JSON on stdout.")
    parser.add_argument("--quiet", action="store_true", help="Suppress progress output on stderr.")
    parser.add_argument("--timeout", type=float, default=30.0, help="Per-call gate timeout in seconds.")
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    return parser


def _selected_worlds(raw: str):
    if raw.strip() in ("", "all"):
        return WORLDS
    names = [name.strip() for name in raw.split(",") if name.strip()]
    unknown = [name for name in names if name not in WORLDS_BY_NAME]
    if unknown:
        raise SystemExit(f"Unknown room(s): {', '.join(unknown)}. Available: {', '.join(WORLDS_BY_NAME)}.")
    return tuple(WORLDS_BY_NAME[name] for name in names)


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _progress(quiet: bool):
    def emit(event: str, payload: dict[str, Any]) -> None:
        if quiet:
            return
        if event == "round_start":
            print(f"  round {payload['round']}: {payload['probes']} new candidates", file=sys.stderr)
        elif event == "finding":
            outcome = payload["outcome"]
            print(f"  ! {outcome.status}: {outcome.probe.probe_id}", file=sys.stderr)
        elif event == "frontier_start":
            print(f"  measuring {payload['name']}", file=sys.stderr)
        elif event == "live_world":
            print(f"  auditing room {payload['world']}", file=sys.stderr)

    return emit


def _build_planner(arguments: argparse.Namespace, quiet: bool):
    deterministic = DeterministicPlanner()
    if arguments.planner != "ollama":
        return deterministic
    planner = OllamaPlanner(deterministic, base_url=arguments.ollama_url, model=arguments.model)
    status = planner.preflight()
    if not quiet:
        print(f"  local model planner: {status} — {planner.detail}", file=sys.stderr)
    return planner


def main(argv: list[str] | None = None) -> int:
    arguments = build_parser().parse_args(argv)
    worlds = _selected_worlds(arguments.worlds)
    repo_root = _repo_root()
    emit = _progress(arguments.quiet)

    run: ProbeRun | None = None
    live: LiveRun | None = None
    unavailable: str | None = None

    if arguments.mode in ("contracts", "both"):
        try:
            with ContractGate(repo_root, timeout_s=arguments.timeout) as gate:
                agent = SafetyProbeAgent(
                    gate=gate,
                    planner=_build_planner(arguments, arguments.quiet),
                    worlds=worlds,
                    max_rounds=arguments.max_rounds,
                    quiet_rounds=arguments.quiet_rounds,
                    measure_boundaries=not arguments.no_boundaries,
                    on_event=emit,
                )
                run = agent.run()
        except GateUnavailable as error:
            unavailable = str(error)

    if arguments.mode in ("live", "both"):
        client = DirectorHttpClient(arguments.base_url, timeout_s=arguments.timeout)
        live = audit_live(client, worlds, on_event=emit)

    if run is None and live is None:
        print(f"error: {unavailable}", file=sys.stderr)
        return EXIT_UNAVAILABLE

    report = build_report(run, live, arguments.mode, repo_root)
    if unavailable:
        report["gateUnavailable"] = unavailable

    if arguments.json:
        print(json.dumps(report, indent=2))
    else:
        print(render_console(report))

    if arguments.out_dir:
        written = write_outputs(report, arguments.out_dir)
        print("\nwrote " + ", ".join(str(path) for path in written))

    return _exit_code(run, live, unavailable)


def _exit_code(run: ProbeRun | None, live: LiveRun | None, unavailable: str | None) -> int:
    if unavailable and run is None:
        return EXIT_UNAVAILABLE
    if run is not None:
        if (
            run.stats.probes == 0
            or run.inconclusive
            or any(frontier.status == "inconclusive" for frontier in run.frontiers)
        ):
            return EXIT_UNAVAILABLE
        if not run.controls_passed:
            return EXIT_FINDINGS
        if run.findings:
            return EXIT_FINDINGS
        if any(
            frontier.status != "measured" or frontier.matches_documented is False
            for frontier in run.frontiers
        ):
            return EXIT_FINDINGS
    if live is not None:
        if live.failures:
            return EXIT_FINDINGS
        if live.inconclusive:
            return EXIT_UNAVAILABLE
    return EXIT_CLEAN


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
