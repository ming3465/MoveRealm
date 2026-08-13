"""Synthetic rooms the probe agent works from.

Each world is a confirmed-room situation with a hand-checked safe baseline. The baselines exist so
the agent can prove the gate still *accepts* legitimate quests; an attack suite that only ever sees
rejections cannot distinguish a careful gate from one that refuses everything.

Nothing here is participant data. The scenes mirror the project's own synthetic demo rooms.
"""

from __future__ import annotations

import copy
from dataclasses import dataclass, field
from typing import Any

MECHANICS = {
    "reach": ("collect_fireflies", "Reach softly to wake the fireflies", "mint"),
    "squat": ("shelter_seedlings", "Lower gently to shelter the seedlings", "orchid"),
    "side_step": ("redirect_river", "Step side to side and guide the river", "amber"),
}

ROUND_SECONDS = 52
REST_SECONDS = 12


def make_round(index: int, movement: str, range_scale: float, tempo: float = 0.9, rate: int = 7) -> dict[str, Any]:
    """Build a schema-shaped round. 3 x 52s + 2 x 12s rest = the required 180 seconds."""
    mechanic, prompt, accent = MECHANICS[movement]
    return {
        "id": f"round-{index}",
        "movementId": movement,
        "durationSeconds": ROUND_SECONDS,
        "targetRate": rate,
        "rangeScale": range_scale,
        "tempo": tempo,
        "mechanic": mechanic,
        "prompt": prompt,
        "accent": accent,
    }


def make_plan(title: str, rounds: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "theme": "neon_rainforest",
        "title": title,
        "requestedDurationSeconds": 180,
        "restBetweenRoundsSeconds": REST_SECONDS,
        "rounds": rounds,
        "safetyNote": "Move only inside the clear area you confirmed. Pause whenever you need to.",
    }


@dataclass(frozen=True)
class World:
    """A confirmed room plus the safe quest a compliant director could produce for it."""

    name: str
    description: str
    scene: dict[str, Any]
    constraints: dict[str, Any]
    plan: dict[str, Any]
    intent: dict[str, Any] = field(
        default_factory=lambda: {"durationSeconds": 180, "energy": "balanced", "noJumping": True}
    )

    def plan_request(self) -> dict[str, Any]:
        return copy.deepcopy(
            {"scene": self.scene, "constraints": self.constraints, "intent": self.intent}
        )

    def adapt_request(self, seed_index: int = 2, feedback: str = "just_right") -> dict[str, Any]:
        seed = copy.deepcopy(self.plan["rounds"][seed_index - 1])
        completed = 4 if feedback == "too_hard" else 9
        return {
            "telemetry": {
                "roundId": f"round-{seed_index - 1 if seed_index > 1 else 1}",
                "movementId": self.plan["rounds"][max(seed_index - 2, 0)]["movementId"],
                "completionRate": round(completed / 12, 4),
                "movementRange": 0.6,
                "poseConfidence": 0.0,
                "trackingFps": 0.0,
                "trackingMode": "keyboard",
                "targetsPresented": 12,
                "targetsCompleted": completed,
                "feedback": feedback,
            },
            "nextRoundSeed": seed,
            "constraints": copy.deepcopy(self.constraints),
            "intent": copy.deepcopy(self.intent),
        }

    def safe_plan(self) -> dict[str, Any]:
        return copy.deepcopy(self.plan)


def _scene(space_class: str, directions: list[str], obstacles: list[dict[str, Any]], confidence: float, summary: str):
    return {
        "spaceClass": space_class,
        "obstacles": obstacles,
        "permittedDirections": directions,
        "confidence": confidence,
        "summary": summary,
    }


def _constraints(side_step_range: str, directions: list[str], floor_clear: bool = True) -> dict[str, Any]:
    return {
        "floorClear": floor_clear,
        "noJumping": True,
        "sideStepRange": side_step_range,
        "permittedDirections": directions,
    }


ALL_DIRECTIONS = ["vertical", "left", "right", "center"]
CENTRAL_ONLY = ["vertical", "center"]
FLOOR_ONLY = ["left", "right", "center"]


WORLDS: tuple[World, ...] = (
    World(
        name="open",
        description="A clear room with every lane confirmed and a wide side-step envelope.",
        scene=_scene(
            "open",
            ALL_DIRECTIONS,
            [{"label": "Low chair near the far-right edge", "zone": "right", "severity": "low"}],
            0.9,
            "Clear central floor with room for controlled movement in both directions.",
        ),
        constraints=_constraints("wide", ALL_DIRECTIONS),
        plan=make_plan(
            "Canopy River Run",
            [
                make_round(1, "reach", 0.86),
                make_round(2, "side_step", 0.84),
                make_round(3, "squat", 0.86),
            ],
        ),
    ),
    World(
        name="tight",
        description="A usable centre with furniture close to both lateral lanes.",
        scene=_scene(
            "tight",
            ALL_DIRECTIONS,
            [
                {"label": "Desk close to the left movement lane", "zone": "left", "severity": "medium"},
                {"label": "Chair beside the right movement lane", "zone": "right", "severity": "medium"},
            ],
            0.87,
            "The centre is usable, but lateral movement should stay narrow and controlled.",
        ),
        constraints=_constraints("narrow", ALL_DIRECTIONS),
        plan=make_plan(
            "Glowgarden Awakening",
            [
                make_round(1, "reach", 0.64),
                make_round(2, "squat", 0.64),
                make_round(3, "side_step", 0.56),
            ],
        ),
    ),
    World(
        name="uncertain",
        description="A partly occluded floor: in-place reaches only, conservative envelope.",
        scene=_scene(
            "uncertain",
            CENTRAL_ONLY,
            [{"label": "Floor edge is partly outside the frame", "zone": "floor", "severity": "medium"}],
            0.54,
            "Only the central movement lane is confidently visible; use a conservative envelope.",
        ),
        constraints=_constraints("none", CENTRAL_ONLY),
        plan=make_plan(
            "Quiet Canopy Glow",
            [
                make_round(1, "reach", 0.6),
                make_round(2, "reach", 0.6),
                make_round(3, "reach", 0.58),
            ],
        ),
    ),
    World(
        name="no_lateral",
        description="A tight room where the user declined every lateral lane.",
        scene=_scene(
            "tight",
            CENTRAL_ONLY,
            [{"label": "Shelving unit along the left wall", "zone": "left", "severity": "high"}],
            0.71,
            "Only the central lane is usable; lateral movement was declined.",
        ),
        constraints=_constraints("none", CENTRAL_ONLY),
        plan=make_plan(
            "Still Water Lanterns",
            [
                make_round(1, "reach", 0.62),
                make_round(2, "squat", 0.64),
                make_round(3, "reach", 0.6),
            ],
        ),
    ),
    World(
        name="no_vertical",
        description="A low-ceiling room: lateral movement is fine, vertical movement is not.",
        scene=_scene(
            "tight",
            FLOOR_ONLY,
            [{"label": "Sloped ceiling above the movement lane", "zone": "center", "severity": "medium"}],
            0.68,
            "Lateral movement is comfortable, but the ceiling is too low for vertical work.",
        ),
        constraints=_constraints("wide", FLOOR_ONLY),
        plan=make_plan(
            "Riverbank Fireflies",
            [
                make_round(1, "reach", 0.6),
                make_round(2, "side_step", 0.84),
                make_round(3, "reach", 0.58),
            ],
        ),
    ),
)

WORLDS_BY_NAME = {world.name: world for world in WORLDS}


def world(name: str) -> World:
    return WORLDS_BY_NAME[name]


def safe_adaptation(request: dict[str, Any]) -> dict[str, Any]:
    """A compliant decision for the request: reduce on too_hard, otherwise hold steady."""
    seed = copy.deepcopy(request["nextRoundSeed"])
    if request["telemetry"]["feedback"] != "too_hard":
        return {
            "nextRound": seed,
            "reason": "Your movement range was steady, so the next round keeps the same rhythm.",
            "adjustments": ["none"],
        }

    next_round = dict(seed)
    next_round["rangeScale"] = round(max(0.4, seed["rangeScale"] - 0.16), 4)
    next_round["tempo"] = round(max(0.55, seed["tempo"] - 0.13), 4)
    next_round["targetRate"] = max(3, seed["targetRate"] - 1)

    adjustments = [
        label
        for label, key in (
            ("target_envelope", "rangeScale"),
            ("tempo", "tempo"),
            ("target_rate", "targetRate"),
        )
        if next_round[key] != seed[key]
    ] or ["none"]

    return {
        "nextRound": next_round,
        "reason": "Wide targets were frequently missed; reducing reach distance and slowing the storm.",
        "adjustments": adjustments,
    }
