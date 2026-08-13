"""Live audit of a running Movement Director adapter.

The HTTP API takes a *request* and returns a plan; it never accepts a caller-supplied plan. So the
live mode asks two different questions from the contract mode:

1. does the adapter refuse malformed or unconfirmed requests, and
2. does every plan and adaptation it actually returns satisfy the documented rules?

Question 2 covers the deterministic fallback and, when CodeBuddy is connected, live model output —
audited by the same independent oracle, without trusting the server's own validation.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from . import oracle
from .fixtures import WORLDS, World
from .gate import DirectorHttpClient, GateUnavailable
from .operators import patch

PASS = "pass"
FAIL = "fail"
INCONCLUSIVE = "inconclusive"


@dataclass(frozen=True)
class Check:
    name: str
    status: str
    detail: str
    world: str = "-"
    endpoint: str = "-"
    director_source: str | None = None
    latency_ms: float | None = None

    def to_json(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "status": self.status,
            "detail": self.detail,
            "world": self.world,
            "endpoint": self.endpoint,
            "directorSource": self.director_source,
            "latencyMs": None if self.latency_ms is None else round(self.latency_ms, 3),
        }


@dataclass
class LiveRun:
    base_url: str
    health: dict[str, Any] = field(default_factory=dict)
    checks: list[Check] = field(default_factory=list)

    @property
    def failures(self) -> list[Check]:
        return [check for check in self.checks if check.status == FAIL]

    @property
    def inconclusive(self) -> list[Check]:
        return [check for check in self.checks if check.status == INCONCLUSIVE]


def _source_of(body: dict[str, Any]) -> str | None:
    meta = body.get("meta")
    return meta.get("source") if isinstance(meta, dict) else None


def _expect_status(
    name: str,
    world: str,
    endpoint: str,
    expected: tuple[int, ...],
    observed: int,
    body: dict[str, Any],
    latency_ms: float,
) -> Check:
    if observed in expected:
        return Check(name, PASS, f"HTTP {observed} as required.", world, endpoint, _source_of(body), latency_ms)
    return Check(
        name,
        FAIL,
        f"Expected HTTP {' or '.join(str(code) for code in expected)} but the adapter returned {observed}.",
        world,
        endpoint,
        _source_of(body),
        latency_ms,
    )


def _audit_returned_plan(world: World, request: dict[str, Any], body: dict[str, Any], latency_ms: float) -> list[Check]:
    checks: list[Check] = []
    source = _source_of(body)
    plan = body.get("data")
    if not isinstance(plan, dict):
        return [Check("Returned plan is present", FAIL, "The response carried no plan object.", world.name, "/api/quest/plan", source, latency_ms)]

    ruling = oracle.audit_plan(plan, request)
    checks.append(
        Check(
            "Returned plan satisfies the documented rules",
            PASS if not ruling.should_reject else FAIL,
            "No documented rule was violated." if not ruling.should_reject else "; ".join(ruling.reasons)[:400],
            world.name,
            "/api/quest/plan",
            source,
            latency_ms,
        )
    )

    rounds = plan.get("rounds") or []
    total = sum(round_value.get("durationSeconds", 0) for round_value in rounds)
    total += plan.get("restBetweenRoundsSeconds", 0) * max(len(rounds) - 1, 0)
    checks.append(
        Check(
            "Returned plan totals exactly 180 seconds",
            PASS if total == 180 else FAIL,
            f"Rounds and rests total {total}s.",
            world.name,
            "/api/quest/plan",
            source,
        )
    )

    meta = body.get("meta") if isinstance(body.get("meta"), dict) else {}
    labelled = bool(meta.get("label")) and meta.get("source") in ("codebuddy", "fallback", "demo")
    checks.append(
        Check(
            "Director provenance is visibly labelled",
            PASS if labelled else FAIL,
            f"source={meta.get('source')!r} label={meta.get('label')!r}",
            world.name,
            "/api/quest/plan",
            source,
        )
    )
    return checks


def _audit_returned_adaptation(
    world: World, request: dict[str, Any], body: dict[str, Any], latency_ms: float
) -> list[Check]:
    source = _source_of(body)
    decision = body.get("data")
    if not isinstance(decision, dict):
        return [
            Check(
                "Returned adaptation is present",
                FAIL,
                "The response carried no adaptation object.",
                world.name,
                "/api/quest/adapt",
                source,
                latency_ms,
            )
        ]

    ruling = oracle.audit_adaptation(decision, request)
    checks = [
        Check(
            "Returned adaptation satisfies the documented rules",
            PASS if not ruling.should_reject else FAIL,
            "No documented rule was violated." if not ruling.should_reject else "; ".join(ruling.reasons)[:400],
            world.name,
            "/api/quest/adapt",
            source,
            latency_ms,
        )
    ]

    seed = request["nextRoundSeed"]
    next_round = decision.get("nextRound") or {}
    reduced = any(
        isinstance(next_round.get(key), (int, float)) and next_round[key] < seed[key]
        for key in ("rangeScale", "tempo", "targetRate")
    )
    checks.append(
        Check(
            "A too-hard round visibly gets easier",
            PASS if reduced else FAIL,
            f"range {seed['rangeScale']} -> {next_round.get('rangeScale')}, "
            f"tempo {seed['tempo']} -> {next_round.get('tempo')}, "
            f"rate {seed['targetRate']} -> {next_round.get('targetRate')}",
            world.name,
            "/api/quest/adapt",
            source,
        )
    )
    return checks


def audit_live(
    client: DirectorHttpClient,
    worlds: tuple[World, ...] = WORLDS,
    on_event: Any = None,
) -> LiveRun:
    emit = on_event or (lambda _name, _payload: None)
    run = LiveRun(base_url=client.base_url)

    try:
        run.health = client.health()
    except GateUnavailable as error:
        run.checks.append(Check("Adapter health", INCONCLUSIVE, str(error), endpoint="/api/health"))
        return run

    run.checks.append(
        Check(
            "Adapter health",
            PASS if run.health.get("ok") else FAIL,
            f"movementDirector={run.health.get('movementDirector')!r}, "
            f"codeBuddyConnected={run.health.get('codeBuddyConnected')!r}",
            endpoint="/api/health",
        )
    )

    for world in worlds:
        emit("live_world", {"world": world.name})
        request = world.plan_request()
        try:
            status, body, latency = client.plan(request)
        except GateUnavailable as error:
            run.checks.append(Check("Plan request", INCONCLUSIVE, str(error), world.name, "/api/quest/plan"))
            continue

        run.checks.append(
            _expect_status("Confirmed room is planned", world.name, "/api/quest/plan", (200,), status, body, latency)
        )
        if status == 200:
            run.checks.extend(_audit_returned_plan(world, request, body, latency))

        adapt_request = world.adapt_request(feedback="too_hard")
        try:
            status, body, latency = client.adapt(adapt_request)
        except GateUnavailable as error:
            run.checks.append(Check("Adaptation request", INCONCLUSIVE, str(error), world.name, "/api/quest/adapt"))
            continue

        run.checks.append(
            _expect_status(
                "Round telemetry is adapted", world.name, "/api/quest/adapt", (200,), status, body, latency
            )
        )
        if status == 200:
            run.checks.extend(_audit_returned_adaptation(world, adapt_request, body, latency))

    run.checks.extend(_request_refusals(client, worlds[0]))
    return run


def _request_refusals(client: DirectorHttpClient, world: World) -> list[Check]:
    """Adversarial requests the adapter must refuse before any director is consulted."""
    checks: list[Check] = []
    base = world.plan_request()

    cases: list[tuple[str, dict[str, Any], tuple[int, ...], str]] = [
        (
            "Unconfirmed floor is refused",
            patch(base, constraints=patch(base["constraints"], floorClear=False)),
            (422,),
            "/api/quest/plan",
        ),
        (
            "Jumping cannot be opted out of",
            patch(base, intent=patch(base["intent"], noJumping=False)),
            (400,),
            "/api/quest/plan",
        ),
        (
            "A longer session than 180 seconds is refused",
            patch(base, intent=patch(base["intent"], durationSeconds=300)),
            (400,),
            "/api/quest/plan",
        ),
        (
            "An undeclared request field is refused",
            {**base, "coachingMode": "aggressive"},
            (400,),
            "/api/quest/plan",
        ),
        (
            "An invented movement direction is refused",
            patch(base, constraints=patch(base["constraints"], permittedDirections=["diagonal"])),
            (400,),
            "/api/quest/plan",
        ),
    ]

    for name, body, expected, endpoint in cases:
        try:
            status, response, latency = client.plan(body)
        except GateUnavailable as error:
            checks.append(Check(name, INCONCLUSIVE, str(error), world.name, endpoint))
            continue
        checks.append(_expect_status(name, world.name, endpoint, expected, status, response, latency))

    adapt_request = world.adapt_request(feedback="too_hard")
    impossible = patch(
        adapt_request,
        telemetry=patch(adapt_request["telemetry"], targetsCompleted=99, targetsPresented=12),
    )
    try:
        status, response, latency = client.adapt(impossible)
        checks.append(
            _expect_status(
                "Impossible telemetry counts are refused",
                world.name,
                "/api/quest/adapt",
                (400,),
                status,
                response,
                latency,
            )
        )
    except GateUnavailable as error:
        checks.append(
            Check("Impossible telemetry counts are refused", INCONCLUSIVE, str(error), world.name, "/api/quest/adapt")
        )

    return checks
