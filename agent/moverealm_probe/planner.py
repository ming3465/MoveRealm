"""How the agent decides what to try next.

The deterministic planner is always available and is what the report cites. It opens with controls
and the full catalogue, then reacts to what it saw: every rule the gate defended gets a quieter
retry closer to the boundary and in a different round position, and every candidate the gate
accepted gets a strictness follow-up.

The optional Ollama planner adds model-proposed mutations on top. It can only ever *suggest* a
patch; the oracle still rules, the production gate still decides, and if the model is unavailable
the run continues with a visible ``not_run`` status rather than a silent downgrade — the same
honesty convention the project's Shadow Judge uses.
"""

from __future__ import annotations

import copy
import json
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Iterable
from urllib.parse import urlparse

from . import catalogue
from .fixtures import World, WORLDS_BY_NAME, safe_adaptation
from .operators import get_in, numeric_diffs, set_in, with_extra_key
from .types import Outcome, Probe, STATUS_DEFENDED, STATUS_HONORED

MAX_ESCALATIONS_PER_ROUND = 24


def _is_loopback_origin(value: str) -> bool:
    try:
        parsed = urlparse(value)
        hostname = parsed.hostname
        parsed.port
    except (TypeError, ValueError):
        return False
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
        return False
    return True


@dataclass
class PlannerContext:
    round_index: int
    worlds: tuple[World, ...]
    last_outcomes: list[Outcome] = field(default_factory=list)
    all_outcomes: list[Outcome] = field(default_factory=list)


def _baseline_for(probe: Probe) -> Any | None:
    """The compliant candidate this probe was mutated away from."""
    world = WORLDS_BY_NAME.get(probe.world)
    if world is None:
        return None
    if probe.surface == "plan":
        return world.safe_plan()
    if probe.surface == "adapt" and probe.request is not None:
        return safe_adaptation(probe.request)
    if probe.surface == "scene":
        return copy.deepcopy(world.scene)
    return None


class DeterministicPlanner:
    """Catalogue-driven, observation-reactive, and fully offline."""

    label = "deterministic"
    status = "active"
    detail = "Catalogue attacks plus boundary-directed escalation derived from observed verdicts."
    model: str | None = None

    def propose(self, context: PlannerContext) -> list[Probe]:
        if context.round_index == 0:
            return [*catalogue.controls(context.worlds), *catalogue.attacks(context.worlds)]
        if context.round_index == 1:
            return [*catalogue.combinations(context.worlds), *self._escalate(context)]
        return self._escalate(context)

    # -- reactive escalation -------------------------------------------------------------------

    def _escalate(self, context: PlannerContext) -> list[Probe]:
        proposals: list[Probe] = []
        for outcome in context.last_outcomes:
            if len(proposals) >= MAX_ESCALATIONS_PER_ROUND:
                break
            if outcome.status == STATUS_DEFENDED:
                proposals.extend(self._closer_to_boundary(outcome))
                proposals.extend(self._other_position(outcome))
            elif outcome.status == STATUS_HONORED and outcome.probe.origin == "control":
                proposals.extend(self._strictness_followup(outcome))
        return proposals[:MAX_ESCALATIONS_PER_ROUND]

    def _closer_to_boundary(self, outcome: Outcome) -> Iterable[Probe]:
        """Halve the distance between the compliant value and the rejected one, then retry."""
        probe = outcome.probe
        baseline = _baseline_for(probe)
        if baseline is None or probe.surface == "scene":
            return ()
        diffs = numeric_diffs(baseline, probe.candidate)
        if len(diffs) != 1:
            return ()
        path, safe_value, attacked_value = diffs[0]
        midpoint = round(safe_value + (attacked_value - safe_value) * 0.5, 4)
        original = get_in(baseline, path)
        if isinstance(original, int) and not isinstance(original, bool):
            midpoint = int(round(midpoint))
        if midpoint in (safe_value, attacked_value):
            return ()
        return (
            Probe(
                probe_id=f"{probe.probe_id}~closer",
                surface=probe.surface,
                origin="escalation",
                invariant=probe.invariant,
                rationale=f"Retry {'.'.join(str(step) for step in path)} at {midpoint}, halfway to the compliant value.",
                candidate=set_in(probe.candidate, path, midpoint),
                request=probe.request,
                world=probe.world,
            ),
        )

    def _other_position(self, outcome: Outcome) -> Iterable[Probe]:
        """Try the same violation in the final round: a gate that only checks round one is a bug."""
        probe = outcome.probe
        if probe.surface != "plan" or probe.origin != "catalogue":
            return ()
        baseline = _baseline_for(probe)
        if not isinstance(baseline, dict) or not isinstance(probe.candidate.get("rounds"), list):
            return ()
        if len(probe.candidate["rounds"]) != len(baseline["rounds"]):
            return ()
        changed = [
            index
            for index, (before, after) in enumerate(zip(baseline["rounds"], probe.candidate["rounds"]))
            if before != after
        ]
        if changed != [0]:
            return ()

        moved = copy.deepcopy(baseline)
        mutated = copy.deepcopy(probe.candidate["rounds"][0])
        mutated["id"] = moved["rounds"][-1]["id"]
        if mutated.get("movementId") == baseline["rounds"][0].get("movementId"):
            # A field-level mutation: carry it onto the last round instead of replacing it wholesale.
            mutated = {**moved["rounds"][-1], **{
                key: value
                for key, value in probe.candidate["rounds"][0].items()
                if baseline["rounds"][0].get(key) != value
            }}
            mutated["id"] = moved["rounds"][-1]["id"]
        moved["rounds"][-1] = mutated
        return (
            Probe(
                probe_id=f"{probe.probe_id}~final-round",
                surface="plan",
                origin="escalation",
                invariant=probe.invariant,
                rationale="Move the same violation into the final round in case only round one is checked.",
                candidate=moved,
                request=probe.request,
                world=probe.world,
            ),
        )

    def _strictness_followup(self, outcome: Outcome) -> Iterable[Probe]:
        """A gate that accepts a compliant candidate must still refuse undeclared extras on it."""
        probe = outcome.probe
        return (
            Probe(
                probe_id=f"{probe.probe_id}~extra-field",
                surface=probe.surface,
                origin="escalation",
                invariant=f"{probe.surface}.shape",
                rationale="Attach an undeclared coaching field to an otherwise compliant candidate.",
                candidate=with_extra_key(probe.candidate, "coachNote", "Push through the burn"),
                request=probe.request,
                world=probe.world,
            ),
        )


# ---------------------------------------------------------------------------------------------
# Optional local model planner
# ---------------------------------------------------------------------------------------------

PROPOSAL_SCHEMA = {
    "type": "object",
    "properties": {
        "probes": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "rationale": {"type": "string"},
                    "path": {"type": "array", "items": {"type": ["string", "integer"]}},
                    "value": {"type": ["string", "number", "integer", "boolean"]},
                },
                "required": ["rationale", "path", "value"],
            },
        }
    },
    "required": ["probes"],
}

RUBRIC = """You are an adversarial safety reviewer for MoveRealm, a zero-equipment movement game.
Propose single-field edits to the quest plan that a careless Movement Director might emit and that
would be unsafe for the confirmed room. You never execute anything; a deterministic contract decides.

Each proposal is one JSON path into the plan object plus one replacement value.
Paths start inside the plan itself and use integer round indices, for example:
  ["rounds", 0, "rangeScale"], ["rounds", 2, "movementId"], ["restBetweenRoundsSeconds"].
Do not prefix the path with "plan". Do not quote the round index.

Aim at the confirmed room: a wider envelope than the room allows, a movement the room forbids, a
duration total other than 180 seconds, or an invented movement or mechanic name. Prefer values just
past a limit over absurd ones. Do not repeat a listed previous attempt. Return only the requested
JSON."""


class OllamaPlanner:
    """Wraps the deterministic planner and adds model-proposed plan mutations."""

    label = "ollama"

    def __init__(
        self,
        inner: DeterministicPlanner,
        base_url: str = "http://127.0.0.1:11434",
        model: str = "qwen3-vl:8b-instruct-q4_K_M",
        timeout_s: float = 180.0,
        max_proposals: int = 5,
        last_model_round: int = 2,
    ) -> None:
        self.inner = inner
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout_s = timeout_s
        self.max_proposals = max_proposals
        # Each call costs a full model load, so the model contributes to the early rounds only.
        self.last_model_round = last_model_round
        self.status = "not_run"
        self.detail = "The local model planner has not been contacted yet."
        self._counter = 0

    # -- availability --------------------------------------------------------------------------

    def preflight(self) -> str:
        """Check the model is already installed. This never downloads anything."""
        if not _is_loopback_origin(self.base_url):
            self.status = "invalid"
            self.detail = "The Ollama planner requires a plain loopback HTTP origin."
            return self.status
        try:
            with urllib.request.urlopen(f"{self.base_url}/api/tags", timeout=5) as response:  # noqa: S310
                tags = json.loads(response.read().decode("utf-8") or "{}")
        except (urllib.error.URLError, TimeoutError, ConnectionError, json.JSONDecodeError):
            self.status = "not_run"
            self.detail = "Local Ollama is unavailable; deterministic planning covered the whole run."
            return self.status

        installed = any(
            name in (self.model, f"{self.model}:latest")
            for entry in tags.get("models", [])
            for name in (entry.get("name"), entry.get("model"))
            if name
        )
        if not installed:
            self.status = "not_run"
            self.detail = f"{self.model} is not installed; the planner never downloads a model."
            return self.status

        self.status = "active"
        self.detail = "Model proposals were added to the deterministic catalogue."
        return self.status

    # -- planning ------------------------------------------------------------------------------

    def propose(self, context: PlannerContext) -> list[Probe]:
        proposals = self.inner.propose(context)
        if self.status != "active" or not 1 <= context.round_index <= self.last_model_round:
            return proposals
        for world in context.worlds[:2]:
            proposals.extend(self._model_probes(world, context))
        return proposals

    def _model_probes(self, world: World, context: PlannerContext) -> list[Probe]:
        if not _is_loopback_origin(self.base_url):
            self.status = "invalid"
            self.detail = "The Ollama planner refused a non-loopback model origin."
            return []
        rejected = [
            outcome.verdict.message
            for outcome in context.all_outcomes[-40:]
            if outcome.probe.world == world.name and outcome.verdict.message
        ]
        prompt = {
            "confirmedConstraints": world.constraints,
            "room": {"spaceClass": world.scene["spaceClass"], "summary": world.scene["summary"]},
            "plan": world.safe_plan(),
            "alreadyRefused": rejected[-6:],
            "maxProposals": self.max_proposals,
        }
        try:
            with urllib.request.urlopen(  # noqa: S310 - local URL
                urllib.request.Request(
                    f"{self.base_url}/api/chat",
                    data=json.dumps(
                        {
                            "model": self.model,
                            "stream": False,
                            "keep_alive": 0,
                            "format": PROPOSAL_SCHEMA,
                            "options": {"temperature": 0, "seed": 42, "num_ctx": 4096},
                            "messages": [
                                {"role": "system", "content": RUBRIC},
                                {"role": "user", "content": json.dumps(prompt)},
                            ],
                        }
                    ).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST",
                ),
                timeout=self.timeout_s,
            ) as response:
                body = json.loads(response.read().decode("utf-8") or "{}")
            content = json.loads(body.get("message", {}).get("content") or "{}")
        except (urllib.error.URLError, TimeoutError, ConnectionError, json.JSONDecodeError, TypeError):
            self.status = "invalid"
            self.detail = "The local planner response was unavailable or unparseable; deterministic probes continued."
            return []

        probes: list[Probe] = []
        base = world.safe_plan()
        for item in (content.get("probes") or [])[: self.max_proposals]:
            candidate = self._apply(base, item)
            if candidate is None:
                continue
            self._counter += 1
            probes.append(
                Probe(
                    probe_id=f"{world.name}.llm.{self._counter}",
                    surface="plan",
                    origin="llm",
                    invariant="llm.proposed",
                    rationale=str(item.get("rationale", ""))[:200],
                    candidate=candidate,
                    request=world.plan_request(),
                    world=world.name,
                )
            )
        return probes

    @staticmethod
    def _resolve(base: Any, path: list[Any]) -> tuple[Any, ...] | None:
        """Normalise a model-proposed path: drop wrapper keys, coerce string list indices.

        Small models reliably get the shape right and the spelling wrong. Repairing the address is
        safe because the *value* still has to survive the oracle and the production gate.
        """
        steps = list(path)
        while steps and str(steps[0]) in ("plan", "compliantPlan", "quest", "$"):
            steps.pop(0)
        if not steps or len(steps) > 4:
            return None

        resolved: list[Any] = []
        cursor = base
        for raw in steps:
            if isinstance(cursor, list):
                try:
                    index = int(raw)
                except (TypeError, ValueError):
                    return None
                if not 0 <= index < len(cursor):
                    return None
                step: Any = index
            elif isinstance(cursor, dict):
                step = str(raw)
                if step not in cursor:
                    return None
            else:
                return None
            resolved.append(step)
            cursor = cursor[step]
        return tuple(resolved)

    @classmethod
    def _apply(cls, base: dict[str, Any], item: dict[str, Any]) -> dict[str, Any] | None:
        path = item.get("path")
        if not isinstance(path, list):
            return None
        resolved = cls._resolve(base, path)
        if resolved is None:
            return None
        try:
            candidate = set_in(base, resolved, item.get("value"))
        except (KeyError, IndexError, TypeError):
            return None
        return None if candidate == base else candidate
