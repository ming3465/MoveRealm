"""An independent restatement of MoveRealm's documented movement rules.

This module is deliberately **not** a translation of `src/shared/contracts.ts`. It is written from
the product's stated rules — the README's "What is enforced" section, `docs/EVALUATION.md`, and the
constraints the wire contract declares — so that a gate verdict and this oracle can disagree. A
disagreement is the interesting output: it means the documentation, the oracle, or the gate has
drifted from the other two.

Every rule carries a citation and a tier:

* ``documented`` — stated in README/docs prose that a judge or user could read.
* ``specified``  — stated by the wire contract itself (bounds, enums, declared invariants).
* ``derived``    — a consequence the docs imply but never spell out.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Iterable

from .types import Ruling

EPSILON = 1e-9

MOVEMENT_IDS = ("reach", "squat", "side_step")
MECHANIC_FOR_MOVEMENT = {
    "reach": "collect_fireflies",
    "squat": "shelter_seedlings",
    "side_step": "redirect_river",
}
ACCENTS = ("mint", "orchid", "amber")
DIRECTIONS = ("vertical", "left", "right", "center")
SPACE_CLASSES = ("tight", "open", "uncertain")
SEVERITIES = ("low", "medium", "high")
OBSTACLE_ZONES = ("left", "center", "right", "floor")
ADJUSTMENT_LABELS = ("target_envelope", "tempo", "target_rate", "none")

ROUND_KEYS = frozenset(
    {
        "id",
        "movementId",
        "durationSeconds",
        "targetRate",
        "rangeScale",
        "tempo",
        "mechanic",
        "prompt",
        "accent",
    }
)
PLAN_KEYS = frozenset(
    {"theme", "title", "requestedDurationSeconds", "restBetweenRoundsSeconds", "rounds", "safetyNote"}
)
SCENE_KEYS = frozenset({"spaceClass", "obstacles", "permittedDirections", "confidence", "summary"})
OBSTACLE_KEYS = frozenset({"label", "zone", "severity"})
ADAPTATION_KEYS = frozenset({"nextRound", "reason", "adjustments"})

# Documented movement envelopes. These thresholds are what the probe agent measures against.
NARROW_SIDE_STEP_MAX_RANGE = 0.62
REACH_MAX_RANGE_WITHOUT_VERTICAL = 0.62
REACH_MAX_RANGE_WITHOUT_LATERAL = 0.7
UNCERTAIN_MAX_RANGE = 0.62
TOTAL_SESSION_SECONDS = 180
REQUIRED_ROUNDS = 3


@dataclass(frozen=True)
class Rule:
    id: str
    tier: str
    source: str
    description: str


def _rules(*rules: Rule) -> dict[str, Rule]:
    return {rule.id: rule for rule in rules}


RULES: dict[str, Rule] = _rules(
    # --- scene ---------------------------------------------------------------------------------
    Rule("scene.shape", "specified", "SceneProfileSchema", "A scene carries exactly the five declared fields."),
    Rule("scene.space_class", "specified", "SceneProfileSchema", "Space class is tight, open, or uncertain."),
    Rule("scene.directions", "specified", "SceneProfileSchema", "One to four unique movement directions."),
    Rule("scene.obstacles", "specified", "SceneProfileSchema", "At most eight well-formed obstacles."),
    Rule("scene.confidence", "specified", "SceneProfileSchema", "Confidence is between 0 and 1."),
    Rule("scene.summary", "specified", "SceneProfileSchema", "Summary is 1-180 trimmed characters."),
    Rule(
        "scene.high_severity_blocks_lane",
        "documented",
        "README - room-constrained planning",
        "A high-severity obstacle blocks the movement lane it occupies.",
    ),
    # --- plan structure ------------------------------------------------------------------------
    Rule("plan.shape", "specified", "QuestPlanSchema", "A plan carries exactly the six declared fields."),
    Rule("plan.theme", "specified", "QuestPlanSchema", "The only world is neon_rainforest."),
    Rule(
        "plan.round_count",
        "documented",
        "README - 'Three rounds plus configured rests'",
        "A quest is exactly three rounds.",
    ),
    Rule(
        "plan.duration_total",
        "documented",
        "README - 'must total exactly 180 seconds'",
        "Rounds plus the rests between them total exactly 180 seconds.",
    ),
    Rule("plan.rest_range", "specified", "QuestPlanSchema", "Rest between rounds is an integer of 0-20 seconds."),
    Rule("plan.round_ids", "derived", "QuestPlanSchema superRefine", "Rounds are ordered round-1 to round-3."),
    Rule(
        "plan.movement_vocabulary",
        "documented",
        "README - 'Exactly three validated movement IDs'",
        "Only reach, squat, and side_step exist; no invented or jumping movement.",
    ),
    Rule(
        "plan.mechanic_pairing",
        "documented",
        "README - 'reaches collect fireflies, squats shelter seedlings, side-steps redirect a river'",
        "Each movement drives its own world mechanic.",
    ),
    Rule("plan.round_bounds", "specified", "QuestRoundSchema", "Round duration, rate, range, and tempo stay in range."),
    Rule("plan.round_copy", "specified", "QuestRoundSchema", "Round prompt and accent stay inside the declared shape."),
    Rule("plan.copy_bounds", "specified", "QuestPlanSchema", "Title and safety note stay inside their length bounds."),
    # --- plan safety ---------------------------------------------------------------------------
    Rule(
        "plan.floor_confirmed",
        "documented",
        "README - user confirms the floor before a quest starts",
        "No quest is planned until the user confirms the floor is clear.",
    ),
    Rule(
        "plan.side_step_requires_lateral",
        "documented",
        "README - 'Side-step range cannot exceed the user-confirmed room envelope'",
        "Side-steps need a confirmed lateral lane and a non-none side-step range.",
    ),
    Rule(
        "plan.side_step_narrow_envelope",
        "documented",
        "README - side-step range is bounded by the confirmed room",
        f"A narrow room caps side-step range scale at {NARROW_SIDE_STEP_MAX_RANGE}.",
    ),
    Rule(
        "plan.squat_requires_vertical",
        "specified",
        "validatePlanSafety",
        "Squats need a permitted vertical lane.",
    ),
    Rule(
        "plan.reach_envelope_without_vertical",
        "specified",
        "validatePlanSafety",
        f"Without a vertical lane, reach range scale is capped at {REACH_MAX_RANGE_WITHOUT_VERTICAL}.",
    ),
    Rule(
        "plan.reach_envelope_without_lateral",
        "specified",
        "validatePlanSafety",
        f"Without a lateral lane, reach range scale is capped at {REACH_MAX_RANGE_WITHOUT_LATERAL}.",
    ),
    Rule(
        "plan.uncertain_conservative_envelope",
        "documented",
        "docs/EVALUATION.md - 'fails closed to in-place reaches for uncertain rooms'",
        f"An uncertain room caps every range scale at {UNCERTAIN_MAX_RANGE}.",
    ),
    Rule(
        "plan.uncertain_reach_only",
        "documented",
        "docs/EVALUATION.md - occluded floor rejects squats",
        "An uncertain room permits in-place reach rounds only.",
    ),
    # --- adaptation ----------------------------------------------------------------------------
    Rule("adapt.shape", "specified", "AdaptationDecisionSchema", "A decision carries exactly its three fields."),
    Rule("adapt.reason", "specified", "AdaptationDecisionSchema", "The reason is 1-150 trimmed characters."),
    Rule("adapt.adjustment_labels", "specified", "AdaptationDecisionSchema", "One to three unique adjustment labels."),
    Rule("adapt.none_exclusive", "specified", "AdaptationDecisionSchema", "'none' cannot be combined with a change."),
    Rule(
        "adapt.preserve_movement",
        "documented",
        "README - 'it cannot replace the next movement'",
        "An adaptation may tune a validated round but never swaps its identity, movement, duration, or mechanic.",
    ),
    Rule(
        "adapt.declared_matches_actual",
        "documented",
        "README - adaptation is visibly labelled",
        "Declared adjustments match the parameters that actually changed.",
    ),
    Rule(
        "adapt.too_hard_no_increase",
        "documented",
        "README - adaptation tunes difficulty from telemetry",
        "A too-hard round never raises range, tempo, or target rate.",
    ),
    Rule(
        "adapt.too_hard_must_reduce",
        "specified",
        "validateAdaptationSafety",
        "A too-hard round visibly reduces at least one parameter while one can still be reduced.",
    ),
    Rule(
        "adapt.side_step_requires_lateral",
        "documented",
        "README - side-step range is bounded by the confirmed room",
        "An adaptation cannot reintroduce disabled lateral movement.",
    ),
    Rule(
        "adapt.side_step_narrow_envelope",
        "documented",
        "README - side-step range is bounded by the confirmed room",
        f"A narrow room caps an adapted side-step at {NARROW_SIDE_STEP_MAX_RANGE}.",
    ),
    Rule(
        "adapt.reach_envelope_without_vertical",
        "specified",
        "validateAdaptationSafety",
        f"Without a vertical lane, an adapted reach is capped at {REACH_MAX_RANGE_WITHOUT_VERTICAL}.",
    ),
    Rule(
        "adapt.reach_envelope_without_lateral",
        "specified",
        "validateAdaptationSafety",
        f"Without a lateral lane, an adapted reach is capped at {REACH_MAX_RANGE_WITHOUT_LATERAL}.",
    ),
    Rule(
        "adapt.conservative_envelope_lock",
        "specified",
        "validateAdaptationSafety",
        "A conservative validated envelope cannot be widened when no lateral lane exists.",
    ),
    Rule("adapt.round_bounds", "specified", "QuestRoundSchema", "The adapted round stays inside the round bounds."),
)


# ---------------------------------------------------------------------------------------------
# Small helpers. These keep each rule readable and keep type confusion out of the rule bodies.
# ---------------------------------------------------------------------------------------------


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _is_int(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _in_range(value: Any, low: float, high: float) -> bool:
    return _is_number(value) and low - EPSILON <= value <= high + EPSILON


def _text_len_ok(value: Any, low: int, high: int) -> bool:
    return isinstance(value, str) and low <= len(value.strip()) <= high


def _exact_keys(value: Any, keys: Iterable[str]) -> bool:
    return isinstance(value, dict) and set(value) == set(keys)


def _lateral_allowed(constraints: dict[str, Any]) -> bool:
    directions = constraints.get("permittedDirections") or []
    return any(direction in ("left", "right") for direction in directions)


def _vertical_allowed(constraints: dict[str, Any]) -> bool:
    return "vertical" in (constraints.get("permittedDirections") or [])


def _exceeds(value: Any, cap: float) -> bool:
    return _is_number(value) and value > cap + EPSILON


class _Report:
    """Collects (rule_id, reason) pairs while the rule bodies run."""

    def __init__(self) -> None:
        self.violated: list[str] = []
        self.reasons: list[str] = []

    def fail(self, rule_id: str, reason: str) -> None:
        if rule_id not in self.violated:
            self.violated.append(rule_id)
            self.reasons.append(reason)

    def check(self, ok: bool, rule_id: str, reason: str) -> None:
        if not ok:
            self.fail(rule_id, reason)

    def ruling(self) -> Ruling:
        return Ruling(
            should_reject=bool(self.violated),
            violated=tuple(self.violated),
            reasons=tuple(self.reasons),
        )


# ---------------------------------------------------------------------------------------------
# Scene
# ---------------------------------------------------------------------------------------------


def audit_scene(candidate: Any) -> Ruling:
    report = _Report()
    if not _exact_keys(candidate, SCENE_KEYS):
        report.fail("scene.shape", "The scene does not carry exactly the declared fields.")
        return report.ruling()

    report.check(
        candidate["spaceClass"] in SPACE_CLASSES,
        "scene.space_class",
        f"Unknown space class {candidate['spaceClass']!r}.",
    )

    directions = candidate["permittedDirections"]
    if not isinstance(directions, list) or not 1 <= len(directions) <= 4:
        report.fail("scene.directions", "Permitted directions must be a list of one to four entries.")
    elif any(direction not in DIRECTIONS for direction in directions):
        report.fail("scene.directions", "An unknown movement direction was listed.")
    elif len(set(directions)) != len(directions):
        report.fail("scene.directions", "Movement directions must be unique.")

    obstacles = candidate["obstacles"]
    if not isinstance(obstacles, list) or len(obstacles) > 8:
        report.fail("scene.obstacles", "Obstacles must be a list of at most eight entries.")
        obstacles = []
    for obstacle in obstacles:
        if not _exact_keys(obstacle, OBSTACLE_KEYS):
            report.fail("scene.obstacles", "An obstacle does not carry exactly label, zone, and severity.")
            continue
        if not _text_len_ok(obstacle["label"], 1, 80):
            report.fail("scene.obstacles", "An obstacle label is empty or too long.")
        if obstacle["zone"] not in OBSTACLE_ZONES:
            report.fail("scene.obstacles", f"Unknown obstacle zone {obstacle['zone']!r}.")
        if obstacle["severity"] not in SEVERITIES:
            report.fail("scene.obstacles", f"Unknown obstacle severity {obstacle['severity']!r}.")

    report.check(_in_range(candidate["confidence"], 0.0, 1.0), "scene.confidence", "Confidence is outside 0-1.")
    report.check(_text_len_ok(candidate["summary"], 1, 180), "scene.summary", "Summary length is out of bounds.")

    blocked = {
        obstacle["zone"]
        for obstacle in obstacles
        if isinstance(obstacle, dict) and obstacle.get("severity") == "high" and obstacle.get("zone") != "floor"
    }
    if isinstance(directions, list):
        for direction in directions:
            if direction != "vertical" and direction in blocked:
                report.fail(
                    "scene.high_severity_blocks_lane",
                    f"A high-severity obstacle sits in the permitted {direction} lane.",
                )
                break

    return report.ruling()


# ---------------------------------------------------------------------------------------------
# Rounds shared by plans and adaptations
# ---------------------------------------------------------------------------------------------


def _audit_round(report: _Report, round_value: Any, prefix: str, position: int | None) -> bool:
    """Structural checks for a single round. Returns False when the round is unusable."""
    label = f"Round {position + 1}" if position is not None else "The adapted round"
    if not _exact_keys(round_value, ROUND_KEYS):
        report.fail(f"{prefix}.shape", f"{label} does not carry exactly the declared fields.")
        return False

    if round_value["movementId"] not in MOVEMENT_IDS:
        report.fail("plan.movement_vocabulary", f"{label} uses unknown movement {round_value['movementId']!r}.")
        return False

    expected_mechanic = MECHANIC_FOR_MOVEMENT[round_value["movementId"]]
    report.check(
        round_value["mechanic"] == expected_mechanic,
        "plan.mechanic_pairing",
        f"{label} pairs {round_value['movementId']} with {round_value['mechanic']!r}.",
    )

    bounds_rule = f"{prefix}.round_bounds"
    report.check(
        _is_int(round_value["durationSeconds"]) and 20 <= round_value["durationSeconds"] <= 90,
        bounds_rule,
        f"{label} duration is outside 20-90 whole seconds.",
    )
    report.check(
        _is_int(round_value["targetRate"]) and 3 <= round_value["targetRate"] <= 16,
        bounds_rule,
        f"{label} target rate is outside 3-16.",
    )
    report.check(_in_range(round_value["rangeScale"], 0.4, 1.0), bounds_rule, f"{label} range scale is outside 0.4-1.")
    report.check(_in_range(round_value["tempo"], 0.55, 1.25), bounds_rule, f"{label} tempo is outside 0.55-1.25.")

    copy_rule = "plan.round_copy" if prefix == "plan" else "adapt.round_bounds"
    report.check(_text_len_ok(round_value["prompt"], 1, 90), copy_rule, f"{label} prompt length is out of bounds.")
    report.check(round_value["accent"] in ACCENTS, copy_rule, f"{label} uses unknown accent {round_value['accent']!r}.")
    return True


def _audit_envelope(
    report: _Report,
    round_value: dict[str, Any],
    constraints: dict[str, Any],
    prefix: str,
    label: str,
) -> None:
    """Room-envelope rules shared by planning and adaptation."""
    movement = round_value.get("movementId")
    range_scale = round_value.get("rangeScale")
    lateral = _lateral_allowed(constraints)
    vertical = _vertical_allowed(constraints)
    side_step_range = constraints.get("sideStepRange")

    if movement == "side_step":
        if side_step_range == "none" or not lateral:
            report.fail(
                f"{prefix}.side_step_requires_lateral",
                f"{label} side-steps without a confirmed lateral lane.",
            )
        if side_step_range == "narrow" and _exceeds(range_scale, NARROW_SIDE_STEP_MAX_RANGE):
            report.fail(
                f"{prefix}.side_step_narrow_envelope",
                f"{label} side-step range {range_scale} exceeds the narrow cap {NARROW_SIDE_STEP_MAX_RANGE}.",
            )

    if movement == "reach":
        if not vertical and _exceeds(range_scale, REACH_MAX_RANGE_WITHOUT_VERTICAL):
            report.fail(
                f"{prefix}.reach_envelope_without_vertical",
                f"{label} reach range {range_scale} exceeds {REACH_MAX_RANGE_WITHOUT_VERTICAL} without a vertical lane.",
            )
        if not lateral and _exceeds(range_scale, REACH_MAX_RANGE_WITHOUT_LATERAL):
            report.fail(
                f"{prefix}.reach_envelope_without_lateral",
                f"{label} reach range {range_scale} exceeds {REACH_MAX_RANGE_WITHOUT_LATERAL} without a lateral lane.",
            )


# ---------------------------------------------------------------------------------------------
# Plan
# ---------------------------------------------------------------------------------------------


def audit_plan(candidate: Any, request: dict[str, Any]) -> Ruling:
    report = _Report()
    constraints = request["constraints"]
    scene = request["scene"]

    if not constraints.get("floorClear"):
        report.fail("plan.floor_confirmed", "The user has not confirmed a clear floor.")

    if not _exact_keys(candidate, PLAN_KEYS):
        report.fail("plan.shape", "The plan does not carry exactly the declared fields.")
        return report.ruling()

    report.check(candidate["theme"] == "neon_rainforest", "plan.theme", "The plan leaves the Neon Rainforest world.")
    report.check(_text_len_ok(candidate["title"], 1, 70), "plan.copy_bounds", "Plan title length is out of bounds.")
    report.check(
        _text_len_ok(candidate["safetyNote"], 1, 150), "plan.copy_bounds", "Safety note length is out of bounds."
    )
    report.check(
        candidate["requestedDurationSeconds"] == TOTAL_SESSION_SECONDS,
        "plan.duration_total",
        "The plan does not request a 180-second adventure.",
    )

    rest = candidate["restBetweenRoundsSeconds"]
    report.check(_is_int(rest) and 0 <= rest <= 20, "plan.rest_range", "Rest between rounds is outside 0-20 seconds.")

    rounds = candidate["rounds"]
    if not isinstance(rounds, list) or len(rounds) != REQUIRED_ROUNDS:
        report.fail("plan.round_count", "A quest must contain exactly three rounds.")
        return report.ruling()

    usable = True
    for index, round_value in enumerate(rounds):
        if not _audit_round(report, round_value, "plan", index):
            usable = False
            continue
        report.check(
            round_value["id"] == f"round-{index + 1}",
            "plan.round_ids",
            f"Round {index + 1} is labelled {round_value['id']!r}.",
        )
        _audit_envelope(report, round_value, constraints, "plan", f"Round {index + 1}")

        if round_value["movementId"] == "squat" and not _vertical_allowed(constraints):
            report.fail("plan.squat_requires_vertical", f"Round {index + 1} squats without a permitted vertical lane.")

        if scene.get("spaceClass") == "uncertain":
            if round_value["movementId"] != "reach":
                report.fail(
                    "plan.uncertain_reach_only",
                    f"Round {index + 1} uses {round_value['movementId']} in an uncertain room.",
                )
            if _exceeds(round_value["rangeScale"], UNCERTAIN_MAX_RANGE):
                report.fail(
                    "plan.uncertain_conservative_envelope",
                    f"Round {index + 1} range {round_value['rangeScale']} exceeds the uncertain-room cap.",
                )

    if usable and _is_int(rest) and all(_is_int(item.get("durationSeconds")) for item in rounds):
        total = sum(item["durationSeconds"] for item in rounds) + rest * (len(rounds) - 1)
        report.check(
            total == TOTAL_SESSION_SECONDS,
            "plan.duration_total",
            f"Rounds and rests total {total}s rather than {TOTAL_SESSION_SECONDS}s.",
        )

    return report.ruling()


# ---------------------------------------------------------------------------------------------
# Adaptation
# ---------------------------------------------------------------------------------------------


def audit_adaptation(candidate: Any, request: dict[str, Any]) -> Ruling:
    report = _Report()
    constraints = request["constraints"]
    seed = request["nextRoundSeed"]
    telemetry = request["telemetry"]

    if not _exact_keys(candidate, ADAPTATION_KEYS):
        report.fail("adapt.shape", "The decision does not carry exactly nextRound, reason, and adjustments.")
        return report.ruling()

    report.check(_text_len_ok(candidate["reason"], 1, 150), "adapt.reason", "The reason length is out of bounds.")

    adjustments = candidate["adjustments"]
    if not isinstance(adjustments, list) or not 1 <= len(adjustments) <= 3:
        report.fail("adapt.adjustment_labels", "Adjustments must be a list of one to three labels.")
        adjustments = []
    elif any(label not in ADJUSTMENT_LABELS for label in adjustments):
        report.fail("adapt.adjustment_labels", "An unknown adjustment label was declared.")
    elif len(set(adjustments)) != len(adjustments):
        report.fail("adapt.adjustment_labels", "Adjustment labels must be unique.")
    elif "none" in adjustments and len(adjustments) != 1:
        report.fail("adapt.none_exclusive", "'none' cannot be combined with a changed parameter.")

    next_round = candidate["nextRound"]
    if not _audit_round(report, next_round, "adapt", None):
        return report.ruling()

    for field_name in ("id", "movementId", "durationSeconds", "mechanic"):
        if next_round.get(field_name) != seed.get(field_name):
            report.fail(
                "adapt.preserve_movement",
                f"The adaptation changed {field_name} from {seed.get(field_name)!r} to {next_round.get(field_name)!r}.",
            )

    _audit_envelope(report, next_round, constraints, "adapt", "The adapted round")

    lateral = _lateral_allowed(constraints)
    if (
        _is_number(seed.get("rangeScale"))
        and seed["rangeScale"] <= UNCERTAIN_MAX_RANGE + EPSILON
        and not lateral
        and _exceeds(next_round.get("rangeScale"), UNCERTAIN_MAX_RANGE)
    ):
        report.fail(
            "adapt.conservative_envelope_lock",
            f"The adaptation widened a conservative {seed['rangeScale']} envelope to {next_round['rangeScale']}.",
        )

    changed = {
        "target_envelope": next_round.get("rangeScale") != seed.get("rangeScale"),
        "tempo": next_round.get("tempo") != seed.get("tempo"),
        "target_rate": next_round.get("targetRate") != seed.get("targetRate"),
    }
    actual = {name for name, did_change in changed.items() if did_change}

    if telemetry.get("feedback") == "too_hard":
        raised = [
            name
            for name, key in (("range", "rangeScale"), ("tempo", "tempo"), ("target rate", "targetRate"))
            if _is_number(next_round.get(key))
            and _is_number(seed.get(key))
            and next_round[key] > seed[key]
        ]
        if raised:
            report.fail(
                "adapt.too_hard_no_increase",
                f"A too-hard round raised {', '.join(raised)}.",
            )
        can_reduce = seed["rangeScale"] > 0.4 or seed["tempo"] > 0.55 or seed["targetRate"] > 3
        if can_reduce and not actual:
            report.fail("adapt.too_hard_must_reduce", "A too-hard round changed nothing that could still be reduced.")

    declared = set(adjustments)
    if not actual:
        if declared != {"none"}:
            report.fail("adapt.declared_matches_actual", "An unchanged adaptation must declare only none.")
    else:
        if "none" in declared:
            report.fail("adapt.declared_matches_actual", "A changed adaptation declared none.")
        elif declared - {"none"} != actual:
            report.fail(
                "adapt.declared_matches_actual",
                f"Declared {sorted(declared)} but actually changed {sorted(actual)}.",
            )

    return report.ruling()


AUDITORS: dict[str, Callable[..., Ruling]] = {
    "scene": lambda candidate, request: audit_scene(candidate),
    "plan": audit_plan,
    "adapt": audit_adaptation,
}


def audit(surface: str, candidate: Any, request: dict[str, Any] | None) -> Ruling:
    """Rule on one candidate for the given gate surface."""
    auditor = AUDITORS.get(surface)
    if auditor is None:
        raise ValueError(f"Unknown gate surface: {surface}")
    return auditor(candidate, request or {})


def tier_of(rule_id: str) -> str:
    rule = RULES.get(rule_id)
    return rule.tier if rule else "derived"


def describe(rule_id: str) -> dict[str, str]:
    rule = RULES.get(rule_id)
    if rule is None:
        return {"id": rule_id, "tier": "derived", "source": "unknown", "description": ""}
    return {"id": rule.id, "tier": rule.tier, "source": rule.source, "description": rule.description}
