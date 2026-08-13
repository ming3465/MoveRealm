"""The probe agent loop.

Goal: find any candidate the documented rules say must be refused and the production gate accepts
anyway — or any compliant candidate it refuses.

The loop is perceive → rule → act → compare → adapt:

1. the planner proposes candidates,
2. the independent oracle rules on each one,
3. the production gate decides,
4. agreement or disagreement is recorded,
5. the next round's proposals are derived from what just happened,

and it stops when consecutive rounds stop producing anything new. A measurement phase then
bisects the envelope thresholds the documentation names.
"""

from __future__ import annotations

import copy
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Protocol

from . import oracle
from .boundary import bisect
from .fixtures import WORLDS, World, safe_adaptation, world as world_named
from .operators import with_round
from .planner import DeterministicPlanner, PlannerContext
from .types import (
    Frontier,
    Outcome,
    Probe,
    RunStats,
    STATUS_BREACH,
    STATUS_DEFENDED,
    STATUS_HONORED,
    STATUS_INCONCLUSIVE,
    STATUS_OVER_REJECTION,
    Verdict,
)


class Gate(Protocol):
    kind: str

    def validate(self, surface: str, candidate: Any, request: dict[str, Any] | None = ...) -> Verdict: ...


class BoundaryUnavailable(RuntimeError):
    """The gate stopped answering while a numeric frontier was being measured."""


def classify(should_reject: bool, verdict: Verdict) -> str:
    if not verdict.reached_gate:
        return STATUS_INCONCLUSIVE
    if should_reject:
        return STATUS_BREACH if verdict.accepted else STATUS_DEFENDED
    return STATUS_HONORED if verdict.accepted else STATUS_OVER_REJECTION


@dataclass
class FrontierSpec:
    name: str
    parameter: str
    world: str
    documented_threshold: float
    low: float
    high: float
    build: Callable[[float], tuple[str, dict[str, Any], dict[str, Any]]]
    integer: bool = False


@dataclass
class ProbeRun:
    """Everything one run observed."""

    started_at: str
    finished_at: str = ""
    gate_kind: str = ""
    gate_info: dict[str, Any] = field(default_factory=dict)
    planner: dict[str, Any] = field(default_factory=dict)
    worlds: tuple[str, ...] = ()
    stats: RunStats = field(default_factory=RunStats)
    outcomes: list[Outcome] = field(default_factory=list)
    frontiers: list[Frontier] = field(default_factory=list)
    termination: str = "exhausted"

    @property
    def findings(self) -> list[Outcome]:
        return [outcome for outcome in self.outcomes if outcome.is_finding]

    @property
    def controls(self) -> list[Outcome]:
        return [outcome for outcome in self.outcomes if outcome.probe.origin == "control"]

    @property
    def controls_passed(self) -> bool:
        controls = self.controls
        return bool(controls) and all(outcome.status == STATUS_HONORED for outcome in controls)

    @property
    def inconclusive(self) -> list[Outcome]:
        return [outcome for outcome in self.outcomes if outcome.status == STATUS_INCONCLUSIVE]


class SafetyProbeAgent:
    def __init__(
        self,
        gate: Gate,
        planner: Any | None = None,
        worlds: tuple[World, ...] = WORLDS,
        max_rounds: int = 6,
        quiet_rounds: int = 2,
        measure_boundaries: bool = True,
        on_event: Callable[[str, dict[str, Any]], None] | None = None,
    ) -> None:
        self.gate = gate
        self.planner = planner or DeterministicPlanner()
        self.worlds = worlds
        self.max_rounds = max_rounds
        self.quiet_rounds = quiet_rounds
        self.measure_boundaries = measure_boundaries
        self.on_event = on_event or (lambda _event, _payload: None)

    # -- main loop -----------------------------------------------------------------------------

    def run(self) -> ProbeRun:
        run = ProbeRun(
            started_at=datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
            gate_kind=getattr(self.gate, "kind", "unknown"),
            gate_info=dict(getattr(self.gate, "info", {}) or {}),
            planner={
                "label": getattr(self.planner, "label", "deterministic"),
                "status": getattr(self.planner, "status", "active"),
                "detail": getattr(self.planner, "detail", ""),
                "model": getattr(self.planner, "model", None),
            },
            worlds=tuple(world.name for world in self.worlds),
        )

        seen: set[str] = set()
        last_outcomes: list[Outcome] = []
        quiet = 0

        for round_index in range(self.max_rounds):
            context = PlannerContext(
                round_index=round_index,
                worlds=self.worlds,
                last_outcomes=last_outcomes,
                all_outcomes=run.outcomes,
            )
            fresh = []
            for probe in self.planner.propose(context):
                key = probe.key()
                if key in seen:
                    continue
                seen.add(key)
                fresh.append(probe)

            if not fresh:
                quiet += 1
                self.on_event("round_dry", {"round": round_index, "quiet": quiet})
                if quiet >= self.quiet_rounds:
                    run.termination = "no_new_probes"
                    break
                last_outcomes = []
                continue

            quiet = 0
            run.stats.rounds += 1
            self.on_event("round_start", {"round": round_index, "probes": len(fresh)})

            last_outcomes = [self._execute(probe) for probe in fresh]
            for outcome in last_outcomes:
                run.outcomes.append(outcome)
                run.stats.record(outcome.status)
                if outcome.is_finding:
                    self.on_event("finding", {"outcome": outcome})

            self.on_event(
                "round_end",
                {
                    "round": round_index,
                    "findings": sum(1 for outcome in last_outcomes if outcome.is_finding),
                },
            )
        else:
            run.termination = "round_budget_reached"

        # The planner label can change after preflight or a failed model call; re-read it.
        run.planner.update(
            {
                "status": getattr(self.planner, "status", "active"),
                "detail": getattr(self.planner, "detail", ""),
            }
        )

        if self.measure_boundaries:
            run.frontiers = self._measure_frontiers()

        run.finished_at = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
        return run

    def _execute(self, probe: Probe) -> Outcome:
        ruling = oracle.audit(probe.surface, probe.candidate, probe.request)
        verdict = self.gate.validate(probe.surface, probe.candidate, probe.request)
        return Outcome(probe, ruling, verdict, classify(ruling.should_reject, verdict))

    # -- measurement phase ---------------------------------------------------------------------

    def _measure_frontiers(self) -> list[Frontier]:
        frontiers: list[Frontier] = []
        available = {world.name for world in self.worlds}
        for spec in self._frontier_specs():
            if spec.world not in available:
                continue
            self.on_event("frontier_start", {"name": spec.name})

            def evaluate(value: float, spec: FrontierSpec = spec) -> bool:
                surface, candidate, request = spec.build(value)
                verdict = self.gate.validate(surface, candidate, request)
                if not verdict.reached_gate:
                    raise BoundaryUnavailable(
                        verdict.message or f"The {surface} gate became unavailable."
                    )
                return verdict.accepted

            try:
                result = bisect(evaluate, spec.low, spec.high, integer=spec.integer)
            except BoundaryUnavailable as error:
                frontiers.append(
                    Frontier(
                        name=spec.name,
                        parameter=spec.parameter,
                        world=spec.world,
                        documented_threshold=spec.documented_threshold,
                        accepted_max=None,
                        rejected_min=None,
                        status="inconclusive",
                        detail=str(error),
                    )
                )
                continue
            frontiers.append(
                Frontier(
                    name=spec.name,
                    parameter=spec.parameter,
                    world=spec.world,
                    documented_threshold=spec.documented_threshold,
                    accepted_max=result.accepted_max,
                    rejected_min=result.rejected_min,
                    status=result.status,
                    detail=result.detail,
                )
            )
        return frontiers

    def _frontier_specs(self) -> list[FrontierSpec]:
        specs: list[FrontierSpec] = []

        def plan_scaler(world_name: str, round_index: int):
            target = world_named(world_name)

            def build(value: float) -> tuple[str, dict[str, Any], dict[str, Any]]:
                return "plan", with_round(target.safe_plan(), round_index, rangeScale=value), target.plan_request()

            return build

        def plan_rate(world_name: str, round_index: int):
            target = world_named(world_name)

            def build(value: float) -> tuple[str, dict[str, Any], dict[str, Any]]:
                return (
                    "plan",
                    with_round(target.safe_plan(), round_index, targetRate=int(value)),
                    target.plan_request(),
                )

            return build

        def adapt_scaler(world_name: str, seed_index: int):
            target = world_named(world_name)

            def build(value: float) -> tuple[str, dict[str, Any], dict[str, Any]]:
                request = target.adapt_request(seed_index=seed_index)
                seed = request["nextRoundSeed"]
                decision = safe_adaptation(request)
                next_round = copy.deepcopy(seed)
                next_round["rangeScale"] = value
                adjustments = ["target_envelope"] if value != seed["rangeScale"] else ["none"]
                decision["nextRound"] = next_round
                decision["adjustments"] = adjustments
                return "adapt", decision, request

            return build

        specs.append(
            FrontierSpec(
                "Narrow-room side-step envelope",
                "rounds[2].rangeScale",
                "tight",
                oracle.NARROW_SIDE_STEP_MAX_RANGE,
                0.4,
                1.0,
                plan_scaler("tight", 2),
            )
        )
        specs.append(
            FrontierSpec(
                "Reach envelope without a vertical lane",
                "rounds[0].rangeScale",
                "no_vertical",
                oracle.REACH_MAX_RANGE_WITHOUT_VERTICAL,
                0.4,
                1.0,
                plan_scaler("no_vertical", 0),
            )
        )
        specs.append(
            FrontierSpec(
                "Reach envelope without a lateral lane",
                "rounds[0].rangeScale",
                "no_lateral",
                oracle.REACH_MAX_RANGE_WITHOUT_LATERAL,
                0.4,
                1.0,
                plan_scaler("no_lateral", 0),
            )
        )
        specs.append(
            FrontierSpec(
                "Uncertain-room envelope",
                "rounds[0].rangeScale",
                "uncertain",
                oracle.UNCERTAIN_MAX_RANGE,
                0.4,
                1.0,
                plan_scaler("uncertain", 0),
            )
        )
        specs.append(
            FrontierSpec(
                "Schema range-scale ceiling in a fully open room",
                "rounds[0].rangeScale",
                "open",
                1.0,
                0.4,
                2.0,
                plan_scaler("open", 0),
            )
        )
        specs.append(
            FrontierSpec(
                "Target-rate ceiling",
                "rounds[0].targetRate",
                "open",
                16,
                3,
                48,
                plan_rate("open", 0),
                integer=True,
            )
        )
        specs.append(
            FrontierSpec(
                "Adapted envelope lock without a lateral lane",
                "nextRound.rangeScale",
                "uncertain",
                oracle.UNCERTAIN_MAX_RANGE,
                0.4,
                1.0,
                adapt_scaler("uncertain", 2),
            )
        )
        return specs
