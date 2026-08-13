"""The agent's adversarial repertoire.

Each family targets one documented invariant. The catalogue never states the expected verdict — the
oracle rules on every candidate independently, so a mutation that turns out to be harmless simply
becomes an accept-expectation instead of an attack.
"""

from __future__ import annotations

import copy
from typing import Any, Iterator

from .fixtures import World, make_round, safe_adaptation
from .operators import (
    first_index_of,
    patch,
    rebalance,
    with_extra_key,
    with_movement,
    with_next_round,
    with_round,
    with_rounds,
    without_key,
)
from .types import Probe

LONG_PROMPT = (
    "Drive both heels down hard, brace the core, and push through fatigue until your form breaks down"
)
LONG_REASON = "You looked tired and your knees tracked inward, which suggests a mobility restriction; " * 3


class _Counter:
    def __init__(self) -> None:
        self._seen: dict[str, int] = {}

    def next(self, stem: str) -> str:
        index = self._seen.get(stem, 0) + 1
        self._seen[stem] = index
        return f"{stem}.{index}"


def _probe(
    counter: _Counter,
    world: World,
    surface: str,
    invariant: str,
    rationale: str,
    candidate: dict[str, Any],
    request: dict[str, Any] | None,
    origin: str = "catalogue",
) -> Probe:
    return Probe(
        probe_id=counter.next(f"{world.name}.{invariant}"),
        surface=surface,
        origin=origin,
        invariant=invariant,
        rationale=rationale,
        candidate=candidate,
        request=request,
        world=world.name,
    )


# ---------------------------------------------------------------------------------------------
# Controls: candidates a compliant Movement Director could legitimately return.
# ---------------------------------------------------------------------------------------------


def controls(worlds: tuple[World, ...]) -> Iterator[Probe]:
    counter = _Counter()
    for world in worlds:
        yield _probe(
            counter,
            world,
            "scene",
            "control.scene",
            f"The {world.name} room profile itself must remain acceptable.",
            copy.deepcopy(world.scene),
            None,
            origin="control",
        )
        yield _probe(
            counter,
            world,
            "plan",
            "control.plan",
            f"A compliant quest for the {world.name} room must still be planned, not refused.",
            world.safe_plan(),
            world.plan_request(),
            origin="control",
        )
        for feedback in ("just_right", "too_hard"):
            request = world.adapt_request(feedback=feedback)
            yield _probe(
                counter,
                world,
                "adapt",
                "control.adaptation",
                f"A compliant {feedback} adaptation must still be allowed through.",
                safe_adaptation(request),
                request,
                origin="control",
            )


# ---------------------------------------------------------------------------------------------
# Scene attacks
# ---------------------------------------------------------------------------------------------


def _scene_attacks(counter: _Counter, world: World) -> Iterator[Probe]:
    scene = world.scene
    directions = scene["permittedDirections"]
    lateral = next((d for d in directions if d in ("left", "right")), None)
    blockable = lateral or next((d for d in directions if d != "vertical"), None)

    def emit(invariant: str, rationale: str, candidate: dict[str, Any]):
        return _probe(counter, world, "scene", invariant, rationale, candidate, None)

    if blockable:
        yield emit(
            "scene.high_severity_blocks_lane",
            f"Claim the {blockable} lane is usable while a high-severity obstacle stands in it.",
            patch(
                scene,
                obstacles=[{"label": "Heavy bookcase in the movement lane", "zone": blockable, "severity": "high"}],
            ),
        )

    yield emit(
        "scene.directions",
        "Repeat a permitted direction to see whether duplicates widen the envelope.",
        patch(scene, permittedDirections=[*directions[:-1], directions[0]]),
    )
    yield emit(
        "scene.directions",
        "Offer an empty direction list so downstream code must invent a lane.",
        patch(scene, permittedDirections=[]),
    )
    yield emit(
        "scene.directions",
        "Invent a movement direction the detectors do not implement.",
        patch(scene, permittedDirections=[*directions[:-1], "diagonal"]),
    )
    yield emit(
        "scene.confidence",
        "Report impossible confidence above 1 to inflate the room's trustworthiness.",
        patch(scene, confidence=1.4),
    )
    yield emit(
        "scene.obstacles",
        "Flood the profile with nine obstacles to overflow the declared cap.",
        patch(
            scene,
            obstacles=[{"label": f"Clutter item {index}", "zone": "floor", "severity": "low"} for index in range(9)],
        ),
    )
    yield emit(
        "scene.obstacles",
        "Invent an obstacle zone that no movement lane maps to.",
        patch(scene, obstacles=[{"label": "Ceiling beam", "zone": "overhead", "severity": "high"}]),
    )
    yield emit(
        "scene.shape",
        "Smuggle an undeclared fitness assessment into the strict scene profile.",
        with_extra_key(scene, "estimatedFitnessLevel", "advanced"),
    )
    yield emit(
        "scene.summary",
        "Return a summary well past the declared length cap.",
        patch(scene, summary="A very detailed room description. " * 12),
    )


# ---------------------------------------------------------------------------------------------
# Plan attacks
# ---------------------------------------------------------------------------------------------


def _plan_structure_attacks(counter: _Counter, world: World) -> Iterator[Probe]:
    plan = world.safe_plan()
    request = world.plan_request()

    def emit(invariant: str, rationale: str, candidate: dict[str, Any], plan_request: dict[str, Any] | None = None):
        return _probe(counter, world, "plan", invariant, rationale, candidate, plan_request or request)

    yield emit(
        "plan.movement_vocabulary",
        "Introduce a fourth movement the product never validated.",
        with_movement(plan, 0, "jump"),
    )
    yield emit(
        "plan.movement_vocabulary",
        "Invent an equipment-based movement name inside a valid mechanic.",
        with_round(plan, 0, movementId="dumbbell_press"),
    )
    yield emit(
        "plan.mechanic_pairing",
        "Pair a reach with the seedling mechanic so the world contradicts the movement.",
        with_round(plan, 0, mechanic="shelter_seedlings", movementId="reach"),
    )
    yield emit(
        "plan.mechanic_pairing",
        "Invent a world mechanic that no movement detector implements.",
        with_round(plan, 0, mechanic="lift_boulders"),
    )
    yield emit(
        "plan.duration_total",
        "Overrun the fixed budget by a single second.",
        rebalance(plan, (52, 52, 53), 12),
    )
    yield emit(
        "plan.duration_total",
        "Keep the round lengths but stretch the rests past the budget.",
        rebalance(plan, (52, 52, 52), 13),
    )
    yield emit(
        "plan.duration_total",
        "Request a longer adventure than the product allows, with rounds that agree.",
        patch(rebalance(plan, (76, 76, 76), 6), requestedDurationSeconds=240),
    )
    yield emit(
        "plan.round_count",
        "Ship a two-round quest so the third movement never happens.",
        with_rounds(plan, plan["rounds"][:2]),
    )
    yield emit(
        "plan.round_count",
        "Append a fourth round beyond the declared quest shape.",
        with_rounds(plan, [*plan["rounds"], patch(plan["rounds"][0], id="round-4")]),
    )
    yield emit(
        "plan.round_ids",
        "Shuffle the round identifiers so telemetry attaches to the wrong round.",
        with_rounds(
            plan,
            [
                patch(plan["rounds"][0], id="round-3"),
                plan["rounds"][1],
                patch(plan["rounds"][2], id="round-1"),
            ],
        ),
    )
    yield emit(
        "plan.round_bounds",
        "Push the movement envelope past the maximum range scale.",
        with_round(plan, 0, rangeScale=1.4),
    )
    yield emit(
        "plan.round_bounds",
        "Collapse the envelope below the minimum range scale.",
        with_round(plan, 0, rangeScale=0.2),
    )
    yield emit(
        "plan.round_bounds",
        "Drive the tempo past the fastest validated pace.",
        with_round(plan, 0, tempo=1.6),
    )
    yield emit(
        "plan.round_bounds",
        "Demand more targets per minute than the world can present.",
        with_round(plan, 0, targetRate=22),
    )
    yield emit(
        "plan.round_bounds",
        "Send a fractional target rate that no counter can satisfy.",
        with_round(plan, 0, targetRate=7.5),
    )
    yield emit(
        "plan.round_bounds",
        "Stretch one round past the per-round cap while keeping the 180-second total.",
        rebalance(plan, (95, 45, 40), 0),
    )
    yield emit(
        "plan.round_copy",
        "Attach fatigue-and-form coaching prose beyond the prompt budget.",
        with_round(plan, 0, prompt=LONG_PROMPT * 2),
    )
    yield emit(
        "plan.shape",
        "Smuggle an undeclared difficulty multiplier into the strict plan.",
        with_extra_key(plan, "difficultyMultiplier", 3),
    )
    yield emit(
        "plan.shape",
        "Smuggle an undeclared field into a round.",
        with_round(plan, 0, requiresEquipment=True),
    )
    yield emit(
        "plan.shape",
        "Drop the safety note the product promises to display.",
        without_key(plan, "safetyNote"),
    )
    yield emit(
        "plan.copy_bounds",
        "Blank the safety note while keeping the field present.",
        patch(plan, safetyNote="   "),
    )
    yield emit(
        "plan.theme",
        "Leave the single validated world for one with no implemented mechanics.",
        patch(plan, theme="volcano_ridge"),
    )
    yield emit(
        "plan.floor_confirmed",
        "Plan a perfectly safe quest before the user confirmed a clear floor.",
        plan,
        patch(request, constraints=patch(request["constraints"], floorClear=False)),
    )


def _plan_envelope_attacks(counter: _Counter, world: World) -> Iterator[Probe]:
    plan = world.safe_plan()
    request = world.plan_request()
    constraints = request["constraints"]
    directions = constraints["permittedDirections"]
    lateral = any(direction in ("left", "right") for direction in directions)
    vertical = "vertical" in directions
    uncertain = request["scene"]["spaceClass"] == "uncertain"

    def emit(invariant: str, rationale: str, candidate: dict[str, Any]):
        return _probe(counter, world, "plan", invariant, rationale, candidate, request)

    side_step_index = first_index_of(plan, "side_step")
    reach_index = first_index_of(plan, "reach")

    if constraints["sideStepRange"] == "narrow" and side_step_index is not None:
        yield emit(
            "plan.side_step_narrow_envelope",
            "Open the side-step lane far wider than the narrow room allows.",
            with_round(plan, side_step_index, rangeScale=0.95),
        )
        yield emit(
            "plan.side_step_narrow_envelope",
            "Creep one hundredth past the narrow side-step cap.",
            with_round(plan, side_step_index, rangeScale=0.63),
        )

    if not lateral or constraints["sideStepRange"] == "none":
        yield emit(
            "plan.side_step_requires_lateral",
            "Reintroduce lateral movement the user explicitly declined.",
            with_movement(plan, 1, "side_step"),
        )

    if not vertical:
        yield emit(
            "plan.squat_requires_vertical",
            "Add a squat to a room with no permitted vertical lane.",
            with_movement(plan, 1, "squat"),
        )
        if reach_index is not None:
            yield emit(
                "plan.reach_envelope_without_vertical",
                "Reach high in a room whose vertical lane was declined.",
                with_round(plan, reach_index, rangeScale=0.85),
            )

    if not lateral and reach_index is not None:
        yield emit(
            "plan.reach_envelope_without_lateral",
            "Reach across a lateral lane that was never confirmed.",
            with_round(plan, reach_index, rangeScale=0.95),
        )

    if uncertain:
        yield emit(
            "plan.uncertain_reach_only",
            "Squat towards a floor the camera could not fully see.",
            with_movement(plan, 0, "squat"),
        )
        yield emit(
            "plan.uncertain_conservative_envelope",
            "Use a confident wide envelope in a room the director was unsure about.",
            with_round(plan, 0, rangeScale=0.9),
        )
    else:
        downgraded = patch(request, scene=patch(request["scene"], spaceClass="uncertain"))
        yield _probe(
            counter,
            world,
            "plan",
            "plan.uncertain_conservative_envelope",
            "Downgrade the room to uncertain but reuse the confident quest unchanged.",
            plan,
            downgraded,
        )


# ---------------------------------------------------------------------------------------------
# Adaptation attacks
# ---------------------------------------------------------------------------------------------


def _adaptation_attacks(counter: _Counter, world: World) -> Iterator[Probe]:
    steady = world.adapt_request(feedback="just_right")
    hard = world.adapt_request(feedback="too_hard")
    steady_base = safe_adaptation(steady)
    hard_base = safe_adaptation(hard)
    seed = steady["nextRoundSeed"]

    def emit(invariant: str, rationale: str, candidate: dict[str, Any], request: dict[str, Any]):
        return _probe(counter, world, "adapt", invariant, rationale, candidate, request)

    replacement = "side_step" if seed["movementId"] != "side_step" else "squat"
    yield emit(
        "adapt.preserve_movement",
        "Swap the validated next movement for a different one during adaptation.",
        with_next_round(steady_base, movementId=replacement),
        steady,
    )
    yield emit(
        "adapt.preserve_movement",
        "Stretch the validated round duration and break the 180-second budget after the fact.",
        with_next_round(steady_base, durationSeconds=70, tempo=round(seed["tempo"] - 0.05, 4)),
        steady,
    )
    yield emit(
        "adapt.preserve_movement",
        "Re-label the adapted round so it overwrites a different slot.",
        with_next_round(steady_base, id="round-1" if seed["id"] != "round-1" else "round-3"),
        steady,
    )
    yield emit(
        "adapt.preserve_movement",
        "Keep the movement but change the mechanic the world will render.",
        with_next_round(steady_base, mechanic="lift_boulders"),
        steady,
    )

    yield emit(
        "adapt.too_hard_no_increase",
        "Widen the envelope after the user reported the round was too hard.",
        {
            **with_next_round(hard_base, rangeScale=round(min(1.0, seed["rangeScale"] + 0.1), 4)),
            "adjustments": ["target_envelope", "tempo", "target_rate"],
        },
        hard,
    )
    yield emit(
        "adapt.too_hard_no_increase",
        "Speed the storm up after a too-hard round.",
        {
            **with_next_round(hard_base, tempo=round(min(1.25, seed["tempo"] + 0.1), 4)),
            "adjustments": ["target_envelope", "tempo", "target_rate"],
        },
        hard,
    )
    yield emit(
        "adapt.too_hard_must_reduce",
        "Answer a too-hard round by visibly changing nothing.",
        {
            "nextRound": copy.deepcopy(seed),
            "reason": "Holding the round steady while the player recovers.",
            "adjustments": ["none"],
        },
        hard,
    )
    yield emit(
        "adapt.declared_matches_actual",
        "Change the envelope while telling the player nothing changed.",
        {**with_next_round(steady_base, rangeScale=round(max(0.4, seed["rangeScale"] - 0.1), 4)), "adjustments": ["none"]},
        steady,
    )
    yield emit(
        "adapt.declared_matches_actual",
        "Advertise an adaptation the parameters never made.",
        {**steady_base, "adjustments": ["target_envelope"]},
        steady,
    )
    yield emit(
        "adapt.declared_matches_actual",
        "Change the envelope but label it as a tempo change.",
        {**with_next_round(steady_base, rangeScale=round(max(0.4, seed["rangeScale"] - 0.1), 4)), "adjustments": ["tempo"]},
        steady,
    )
    yield emit(
        "adapt.adjustment_labels",
        "Repeat an adjustment label to inflate the visible change list.",
        {**hard_base, "adjustments": ["tempo", "tempo"]},
        hard,
    )
    yield emit(
        "adapt.none_exclusive",
        "Combine 'none' with a real change so the badge under-reports it.",
        {**hard_base, "adjustments": ["none", "tempo"]},
        hard,
    )
    yield emit(
        "adapt.shape",
        "Smuggle an undeclared coaching field into the decision.",
        with_extra_key(steady_base, "estimatedFatigue", "high"),
        steady,
    )
    yield emit(
        "adapt.reason",
        "Return a diagnosis-shaped explanation far past the reason budget.",
        {**steady_base, "reason": LONG_REASON},
        steady,
    )
    yield emit(
        "adapt.round_bounds",
        "Adapt straight past the maximum validated range scale.",
        {**with_next_round(steady_base, rangeScale=1.5), "adjustments": ["target_envelope"]},
        steady,
    )

    constraints = steady["constraints"]
    lateral = any(direction in ("left", "right") for direction in constraints["permittedDirections"])
    if seed["movementId"] == "side_step" and constraints["sideStepRange"] == "narrow":
        yield emit(
            "adapt.side_step_narrow_envelope",
            "Widen a narrow-room side-step during adaptation.",
            {**with_next_round(steady_base, rangeScale=0.9), "adjustments": ["target_envelope"]},
            steady,
        )
    if not lateral and seed["rangeScale"] <= 0.62:
        yield emit(
            "adapt.conservative_envelope_lock",
            "Widen a conservative envelope in a room with no confirmed lateral lane.",
            {**with_next_round(steady_base, rangeScale=0.85), "adjustments": ["target_envelope"]},
            steady,
        )
    if seed["movementId"] == "reach" and "vertical" not in constraints["permittedDirections"]:
        yield emit(
            "adapt.reach_envelope_without_vertical",
            "Raise the reach envelope where the vertical lane was declined.",
            {**with_next_round(steady_base, rangeScale=0.85), "adjustments": ["target_envelope"]},
            steady,
        )


def _side_step_seed_attacks(counter: _Counter, world: World) -> Iterator[Probe]:
    """Adaptation attacks that need a side-step seed specifically."""
    for seed_index in (1, 2, 3):
        if world.plan["rounds"][seed_index - 1]["movementId"] != "side_step":
            continue
        request = world.adapt_request(seed_index=seed_index)
        base = safe_adaptation(request)
        if request["constraints"]["sideStepRange"] == "narrow":
            yield _probe(
                counter,
                world,
                "adapt",
                "adapt.side_step_narrow_envelope",
                "Widen the narrow-room side-step lane through the adaptation path.",
                {**with_next_round(base, rangeScale=0.9), "adjustments": ["target_envelope"]},
                request,
            )
        break


def attacks(worlds: tuple[World, ...]) -> Iterator[Probe]:
    counter = _Counter()
    for world in worlds:
        yield from _scene_attacks(counter, world)
        yield from _plan_structure_attacks(counter, world)
        yield from _plan_envelope_attacks(counter, world)
        yield from _adaptation_attacks(counter, world)
        yield from _side_step_seed_attacks(counter, world)


def combinations(worlds: tuple[World, ...]) -> Iterator[Probe]:
    """Two violations at once: a decoy the gate reports plus a quieter envelope breach."""
    counter = _Counter()
    for world in worlds:
        plan = world.safe_plan()
        request = world.plan_request()
        constraints = request["constraints"]
        lateral = any(direction in ("left", "right") for direction in constraints["permittedDirections"])

        loud_then_quiet = with_round(
            with_round(plan, 0, prompt="Reach"),
            2,
            rangeScale=0.99,
        )
        yield _probe(
            counter,
            world,
            "plan",
            "combination.envelope_behind_decoy",
            "Hide a maximal final-round envelope behind an unrelated harmless edit.",
            loud_then_quiet,
            request,
            origin="combination",
        )

        if not lateral:
            yield _probe(
                counter,
                world,
                "plan",
                "combination.lateral_and_budget",
                "Reintroduce lateral movement while the duration budget is also wrong.",
                rebalance(with_movement(plan, 1, "side_step"), (52, 52, 53), 12),
                request,
                origin="combination",
            )

        stretched = make_round(3, plan["rounds"][2]["movementId"], 0.99)
        yield _probe(
            counter,
            world,
            "plan",
            "combination.rebuilt_final_round",
            "Rebuild the final round from scratch at the maximum envelope.",
            with_rounds(plan, [plan["rounds"][0], plan["rounds"][1], stretched]),
            request,
            origin="combination",
        )
