"""Evidence output.

The report follows the project's existing evidence conventions: an explicit schema version, honest
statuses instead of silent omissions, a stated scope, and no participant data of any kind. It
records what was observed, not what it would like to have proven.
"""

from __future__ import annotations

import hashlib
import json
import subprocess
from collections import Counter
from pathlib import Path
from typing import Any

from . import SCHEMA_VERSION, __version__, oracle
from .agent import ProbeRun
from .live import LiveRun
from .types import STATUS_DEFENDED, STATUS_HONORED

SCOPE = (
    "Synthetic adversarial candidates evaluated against MoveRealm's production safety contracts. "
    "This is contract-behaviour evidence only: it is not a human trial, a pose or latency "
    "measurement, a security audit, a certification, or an assessment of CodeBuddy's output quality."
)
PRIVACY = (
    "No participant data, camera frame, pose landmark, room still, identity, or health inference is "
    "read or written. Every room in this report is a synthetic fixture defined in the tool itself."
)


def _git_output(repo_root: Path, *arguments: str) -> bytes | None:
    try:
        result = subprocess.run(  # noqa: S603 - fixed local command
            ["git", *arguments],
            cwd=str(repo_root),
            capture_output=True,
            timeout=10,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    return result.stdout if result.returncode == 0 else None


def repo_commit(repo_root: Path) -> str | None:
    raw = _git_output(repo_root, "rev-parse", "HEAD")
    commit = raw.decode("ascii", errors="ignore").strip() if raw is not None else ""
    return commit if len(commit) == 40 else None


def repo_provenance(repo_root: Path) -> dict[str, Any]:
    """Record the committed tree and disclose uncommitted state without leaking path names."""

    commit = repo_commit(repo_root)
    tree_raw = _git_output(repo_root, "rev-parse", "HEAD^{tree}")
    tree = tree_raw.decode("ascii", errors="ignore").strip() if tree_raw is not None else ""
    status = _git_output(
        repo_root,
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
    )
    if status is None:
        return {
            "commit": commit,
            "headTree": tree if len(tree) == 40 else None,
            "dirty": None,
            "statusEntryCount": None,
            "statusSha256": None,
        }
    entries = [line for line in status.splitlines() if line]
    return {
        "commit": commit,
        "headTree": tree if len(tree) == 40 else None,
        "dirty": bool(entries),
        "statusEntryCount": len(entries),
        "statusSha256": hashlib.sha256(status).hexdigest(),
    }


def _invariant_rows(run: ProbeRun) -> list[dict[str, Any]]:
    rows: dict[str, dict[str, Any]] = {}
    for outcome in run.outcomes:
        row = rows.setdefault(
            outcome.probe.invariant,
            {"invariant": outcome.probe.invariant, "probes": 0, "statuses": Counter()},
        )
        row["probes"] += 1
        row["statuses"][outcome.status] += 1

    result = []
    for name, row in sorted(rows.items()):
        statuses: Counter[str] = row["statuses"]
        rule = oracle.RULES.get(name)
        result.append(
            {
                "invariant": name,
                "tier": rule.tier if rule else "n/a",
                "source": rule.source if rule else "n/a",
                "probes": row["probes"],
                "defended": statuses[STATUS_DEFENDED],
                "honored": statuses[STATUS_HONORED],
                "breaches": statuses["breach"],
                "overRejections": statuses["over_rejection"],
                "inconclusive": statuses["inconclusive"],
            }
        )
    return result


def _finding_rows(run: ProbeRun) -> list[dict[str, Any]]:
    rows = []
    for outcome in run.findings:
        rule_ids = outcome.ruling.violated or (outcome.probe.invariant,)
        rows.append(
            {
                **outcome.to_json(),
                "rules": [oracle.describe(rule_id) for rule_id in rule_ids],
                "candidate": outcome.probe.candidate,
                "request": outcome.probe.request,
            }
        )
    return rows


def build_report(
    run: ProbeRun | None,
    live: LiveRun | None,
    mode: str,
    repo_root: Path,
) -> dict[str, Any]:
    repository = repo_provenance(repo_root)
    report: dict[str, Any] = {
        "schemaVersion": SCHEMA_VERSION,
        "tool": "moverealm-safety-probe",
        "toolVersion": __version__,
        "mode": mode,
        "commit": repository["commit"],
        "repository": repository,
        "scope": SCOPE,
        "privacy": PRIVACY,
    }

    if run is not None:
        report["observedAt"] = run.started_at
        report["finishedAt"] = run.finished_at
        report["gate"] = {"kind": run.gate_kind, **run.gate_info}
        report["planner"] = run.planner
        report["worlds"] = list(run.worlds)
        report["termination"] = run.termination
        report["oracle"] = {
            "ruleCount": len(oracle.RULES),
            "tiers": dict(Counter(rule.tier for rule in oracle.RULES.values())),
            "note": (
                "The oracle is an independent restatement of the documented rules. A disagreement "
                "means the docs, the oracle, or the gate has drifted from the other two."
            ),
        }
        report["totals"] = {
            "rounds": run.stats.rounds,
            "probes": run.stats.probes,
            "defended": run.stats.count(STATUS_DEFENDED),
            "honored": run.stats.count(STATUS_HONORED),
            "breaches": run.stats.count("breach"),
            "overRejections": run.stats.count("over_rejection"),
            "inconclusive": run.stats.count("inconclusive"),
        }
        report["controls"] = {
            "count": len(run.controls),
            "passed": run.controls_passed,
            "detail": (
                "Every compliant baseline was accepted, so the refusals below are selective."
                if run.controls_passed
                else "At least one compliant baseline was refused; refusals cannot be read as selective."
            ),
        }
        report["invariants"] = _invariant_rows(run)
        report["frontiers"] = [frontier.to_json() for frontier in run.frontiers]
        report["findings"] = _finding_rows(run)
        report["inconclusiveProbes"] = [
            {**outcome.to_json()} for outcome in run.inconclusive
        ][:20]

    if live is not None:
        report["live"] = {
            "baseUrl": live.base_url,
            "health": live.health,
            "checks": [check.to_json() for check in live.checks],
            "failures": len(live.failures),
            "inconclusive": len(live.inconclusive),
        }

    return report


# ---------------------------------------------------------------------------------------------
# Human-readable output
# ---------------------------------------------------------------------------------------------


def _bar(label: str, value: int, width: int = 22) -> str:
    return f"  {label:<16}{value:>6}"


def render_console(report: dict[str, Any]) -> str:
    lines: list[str] = []
    lines.append("MoveRealm safety probe")
    lines.append(f"  mode            {report['mode']}")
    repository = report.get("repository") or {}
    if repository.get("dirty") is not None:
        lines.append(
            f"  worktree        {'dirty' if repository['dirty'] else 'clean'} "
            f"({repository.get('statusEntryCount', 0)} status entries)"
        )

    if "totals" in report:
        totals = report["totals"]
        gate = report.get("gate", {})
        planner = report.get("planner", {})
        lines.append(f"  gate            {gate.get('kind', '-')}")
        lines.append(f"  planner         {planner.get('label')} ({planner.get('status')})")
        lines.append(f"  rounds          {totals['rounds']} ({report.get('termination')})")
        lines.append("")
        lines.append(f"  probes          {totals['probes']}")
        lines.append(_bar("defended", totals["defended"]))
        lines.append(_bar("honored", totals["honored"]))
        lines.append(_bar("breaches", totals["breaches"]))
        lines.append(_bar("over-rejects", totals["overRejections"]))
        lines.append(_bar("inconclusive", totals["inconclusive"]))

        controls = report.get("controls", {})
        state = "passed" if controls.get("passed") else "FAILED"
        lines.append("")
        lines.append(f"  controls        {controls.get('count', 0)} {state}")

        frontiers = report.get("frontiers") or []
        if frontiers:
            lines.append("")
            lines.append("  Measured envelope frontiers")
            for frontier in frontiers:
                if frontier["status"] != "measured":
                    lines.append(f"    - {frontier['name']}: {frontier['status']} ({frontier['detail']})")
                    continue
                agreement = {True: "matches docs", False: "DIFFERS FROM DOCS", None: "no documented value"}[
                    frontier["matchesDocumented"]
                ]
                lines.append(
                    f"    - {frontier['name']}: accepted <= {frontier['acceptedMax']}, "
                    f"refused >= {frontier['rejectedMin']} (documented {frontier['documentedThreshold']}, {agreement})"
                )

        findings = report.get("findings") or []
        lines.append("")
        if findings:
            lines.append(f"  {len(findings)} finding(s):")
            for finding in findings:
                lines.append(f"    [{finding['status']}] {finding['probeId']} — {finding['rationale']}")
                for reason in finding["oracle"]["reasons"][:2]:
                    lines.append(f"        documented rule: {reason}")
                if finding["gate"]["message"]:
                    lines.append(f"        gate said: {finding['gate']['message'][:140]}")
        else:
            lines.append("  No documented rule was breached and no compliant candidate was refused.")

    if "live" in report:
        live = report["live"]
        lines.append("")
        lines.append(f"  Live adapter    {live['baseUrl']}")
        lines.append(f"    health        {json.dumps(live['health'])}")
        passed = sum(1 for check in live["checks"] if check["status"] == "pass")
        lines.append(f"    checks        {passed}/{len(live['checks'])} passed")
        for check in live["checks"]:
            if check["status"] != "pass":
                lines.append(f"      [{check['status']}] {check['world']} {check['name']}: {check['detail'][:160]}")

    return "\n".join(lines)


def render_markdown(report: dict[str, Any]) -> str:
    lines: list[str] = ["# MoveRealm safety probe", ""]
    lines.append(f"- Tool: `moverealm-safety-probe` {report['toolVersion']}, mode `{report['mode']}`")
    if report.get("commit"):
        lines.append(f"- Repository commit: `{report['commit']}`")
    repository = report.get("repository") or {}
    if repository.get("headTree"):
        lines.append(f"- Repository HEAD tree: `{repository['headTree']}`")
    if repository.get("dirty") is not None:
        state = "dirty" if repository["dirty"] else "clean"
        lines.append(
            f"- Repository worktree: **{state}**; {repository.get('statusEntryCount', 0)} status entries; "
            f"status SHA-256 `{repository.get('statusSha256')}`"
        )
    if report.get("observedAt"):
        lines.append(f"- Observed: {report['observedAt']} to {report.get('finishedAt', '-')}")
    lines.append("")
    lines.append(f"> {report['scope']}")
    lines.append("")

    if "totals" in report:
        totals = report["totals"]
        controls = report["controls"]
        planner = report["planner"]
        lines.append("## Result")
        lines.append("")
        lines.append(
            f"{totals['probes']} adversarial and control candidates were ruled on by "
            f"`{report['gate']['kind']}` across {totals['rounds']} planning rounds "
            f"(`{report['termination']}`). The planner was `{planner['label']}` "
            f"(`{planner['status']}`)."
        )
        lines.append("")
        lines.append("| Outcome | Count |")
        lines.append("|---|---:|")
        lines.append(f"| Unsafe candidate refused (defended) | {totals['defended']} |")
        lines.append(f"| Compliant candidate accepted (honored) | {totals['honored']} |")
        lines.append(f"| **Breach — unsafe candidate accepted** | **{totals['breaches']}** |")
        lines.append(f"| **Over-rejection — compliant candidate refused** | **{totals['overRejections']}** |")
        lines.append(f"| Inconclusive (gate unreachable) | {totals['inconclusive']} |")
        lines.append("")
        lines.append(
            f"Controls: {controls['count']} compliant baselines, "
            f"{'all accepted' if controls['passed'] else 'AT LEAST ONE REFUSED'}. {controls['detail']}"
        )
        lines.append("")

        frontiers = [item for item in report.get("frontiers", []) if item["status"] == "measured"]
        if frontiers:
            lines.append("## Measured envelope frontiers")
            lines.append("")
            lines.append("| Boundary | Room | Accepted up to | Refused from | Documented | Agrees |")
            lines.append("|---|---|---:|---:|---:|---|")
            for frontier in frontiers:
                agrees = {True: "yes", False: "**no**", None: "n/a"}[frontier["matchesDocumented"]]
                lines.append(
                    f"| {frontier['name']} | {frontier['world']} | {frontier['acceptedMax']} | "
                    f"{frontier['rejectedMin']} | {frontier['documentedThreshold']} | {agrees} |"
                )
            lines.append("")

        lines.append("## Invariant coverage")
        lines.append("")
        lines.append("| Invariant | Tier | Probes | Defended | Breaches |")
        lines.append("|---|---|---:|---:|---:|")
        for row in report["invariants"]:
            lines.append(
                f"| `{row['invariant']}` | {row['tier']} | {row['probes']} | {row['defended']} | {row['breaches']} |"
            )
        lines.append("")

        findings = report.get("findings") or []
        lines.append("## Findings")
        lines.append("")
        if not findings:
            lines.append("None. No documented rule was breached and no compliant candidate was refused.")
        else:
            for finding in findings:
                lines.append(f"### `{finding['probeId']}` — {finding['status']}")
                lines.append("")
                lines.append(f"- Attack: {finding['rationale']}")
                lines.append(f"- Room: `{finding['world']}`, surface `{finding['surface']}`")
                for rule in finding["rules"]:
                    lines.append(f"- Documented rule `{rule['id']}` ({rule['tier']}, {rule['source']}): {rule['description']}")
                if finding["gate"]["message"]:
                    lines.append(f"- Gate response: {finding['gate']['message']}")
                lines.append("")
        lines.append("")

    if "live" in report:
        live = report["live"]
        lines.append("## Live adapter audit")
        lines.append("")
        lines.append(f"- Base URL: `{live['baseUrl']}`")
        lines.append(f"- Health: `{json.dumps(live['health'])}`")
        lines.append("")
        lines.append("| Check | Room | Endpoint | Director | Status | Detail |")
        lines.append("|---|---|---|---|---|---|")
        for check in live["checks"]:
            lines.append(
                f"| {check['name']} | {check['world']} | `{check['endpoint']}` | "
                f"{check['directorSource'] or '-'} | {check['status']} | {check['detail'][:160]} |"
            )
        lines.append("")

    lines.append("## Scope and privacy")
    lines.append("")
    lines.append(f"- {report['scope']}")
    lines.append(f"- {report['privacy']}")
    lines.append("")
    return "\n".join(lines)


def write_outputs(report: dict[str, Any], out_dir: Path, stem: str = "safety-probe") -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    json_path = out_dir / f"{stem}.json"
    markdown_path = out_dir / f"{stem}.md"
    json_path.write_text(json.dumps(report, indent=2, sort_keys=False) + "\n", encoding="utf-8")
    markdown_path.write_text(render_markdown(report), encoding="utf-8")
    return [json_path, markdown_path]
