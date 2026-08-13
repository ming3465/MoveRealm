"""Value types shared by the probe agent.

Everything here is frozen and JSON-serialisable so a run can be replayed from its own report.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

# Which production gate a probe is aimed at.
SURFACES = ("scene", "plan", "adapt")

# Why a candidate was refused. `accepted` means the gate let it through.
#   schema          - Zod structural/bounds rejection
#   safety          - a hand-written invariant in validate*Safety threw
#   request_invalid - our own request envelope was malformed (our bug, not the gate's)
#   transport       - the bridge or server could not be reached
VERDICT_KINDS = ("accepted", "schema", "safety", "request_invalid", "transport", "internal")

# Outcome of comparing the oracle's ruling with the gate's verdict.
STATUS_DEFENDED = "defended"          # oracle: reject, gate: reject   (agreement)
STATUS_HONORED = "honored"            # oracle: accept, gate: accept   (agreement)
STATUS_BREACH = "breach"              # oracle: reject, gate: accept   (finding)
STATUS_OVER_REJECTION = "over_rejection"  # oracle: accept, gate: reject (finding)
STATUS_INCONCLUSIVE = "inconclusive"  # the probe never reached the gate

FINDING_STATUSES = (STATUS_BREACH, STATUS_OVER_REJECTION)


@dataclass(frozen=True)
class Verdict:
    """What a production gate said about one candidate."""

    accepted: bool
    kind: str
    message: str = ""
    issues: tuple[dict[str, Any], ...] = ()
    latency_ms: float = 0.0

    @property
    def reached_gate(self) -> bool:
        return self.kind not in ("transport", "request_invalid", "internal")

    def to_json(self) -> dict[str, Any]:
        return {
            "accepted": self.accepted,
            "kind": self.kind,
            "message": self.message,
            "latencyMs": round(self.latency_ms, 3),
        }


@dataclass(frozen=True)
class Ruling:
    """What the independent documented-rule oracle said about the same candidate."""

    should_reject: bool
    violated: tuple[str, ...] = ()
    reasons: tuple[str, ...] = ()

    def to_json(self) -> dict[str, Any]:
        return {
            "shouldReject": self.should_reject,
            "violatedRules": list(self.violated),
            "reasons": list(self.reasons),
        }


@dataclass(frozen=True)
class Probe:
    """One adversarial (or control) candidate aimed at a single gate."""

    probe_id: str
    surface: str
    origin: str  # control | catalogue | escalation | combination | boundary | llm
    invariant: str
    rationale: str
    candidate: dict[str, Any]
    request: dict[str, Any] | None = None
    world: str = "open"

    def key(self) -> str:
        """Stable identity used to avoid re-running the same candidate."""
        import hashlib
        import json

        payload = json.dumps(
            {"s": self.surface, "r": self.request, "c": self.candidate},
            sort_keys=True,
            separators=(",", ":"),
            default=str,
        )
        digest = hashlib.blake2s(payload.encode("utf-8"), digest_size=6).hexdigest()
        return f"{self.surface}:{digest}"

    def to_json(self) -> dict[str, Any]:
        return {
            "probeId": self.probe_id,
            "surface": self.surface,
            "origin": self.origin,
            "invariant": self.invariant,
            "rationale": self.rationale,
            "world": self.world,
        }


@dataclass(frozen=True)
class Outcome:
    """A probe, the oracle's expectation, the gate's answer, and their agreement."""

    probe: Probe
    ruling: Ruling
    verdict: Verdict
    status: str

    @property
    def is_finding(self) -> bool:
        return self.status in FINDING_STATUSES

    def to_json(self) -> dict[str, Any]:
        return {
            **self.probe.to_json(),
            "status": self.status,
            "oracle": self.ruling.to_json(),
            "gate": self.verdict.to_json(),
        }


@dataclass(frozen=True)
class Frontier:
    """A measured accept/reject boundary for one continuous or integer parameter."""

    name: str
    parameter: str
    world: str
    documented_threshold: float | None
    accepted_max: float | None
    rejected_min: float | None
    status: str  # measured | conservative_end_rejected | extreme_end_accepted | inconclusive
    detail: str = ""

    @property
    def matches_documented(self) -> bool | None:
        if self.status != "measured" or self.documented_threshold is None:
            return None
        if self.accepted_max is None or self.rejected_min is None:
            return None
        return self.accepted_max <= self.documented_threshold <= self.rejected_min

    def to_json(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "parameter": self.parameter,
            "world": self.world,
            "status": self.status,
            "documentedThreshold": self.documented_threshold,
            "acceptedMax": self.accepted_max,
            "rejectedMin": self.rejected_min,
            "matchesDocumented": self.matches_documented,
            "detail": self.detail,
        }


@dataclass
class RunStats:
    """Counters accumulated across a run."""

    rounds: int = 0
    probes: int = 0
    by_status: dict[str, int] = field(default_factory=dict)

    def record(self, status: str) -> None:
        self.probes += 1
        self.by_status[status] = self.by_status.get(status, 0) + 1

    def count(self, status: str) -> int:
        return self.by_status.get(status, 0)
