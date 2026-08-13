"""Pure mutation helpers used to build adversarial candidates.

Every helper deep-copies its input, so a base candidate can seed dozens of probes without any
attack contaminating another.
"""

from __future__ import annotations

import copy
from typing import Any

from .fixtures import MECHANICS


def patch(value: dict[str, Any], **fields: Any) -> dict[str, Any]:
    """Return a copy of ``value`` with ``fields`` overwritten."""
    result = copy.deepcopy(value)
    result.update(copy.deepcopy(fields))
    return result


def with_round(plan: dict[str, Any], index: int, **fields: Any) -> dict[str, Any]:
    """Overwrite fields on one round of a plan (0-based index)."""
    result = copy.deepcopy(plan)
    result["rounds"][index] = patch(result["rounds"][index], **fields)
    return result


def with_movement(plan: dict[str, Any], index: int, movement: str, keep_mechanic: bool = False) -> dict[str, Any]:
    """Swap a round's movement, carrying its mechanic and copy unless told to leave them behind."""
    result = copy.deepcopy(plan)
    round_value = result["rounds"][index]
    round_value["movementId"] = movement
    if not keep_mechanic and movement in MECHANICS:
        mechanic, prompt, accent = MECHANICS[movement]
        round_value.update({"mechanic": mechanic, "prompt": prompt, "accent": accent})
    return result


def with_next_round(decision: dict[str, Any], **fields: Any) -> dict[str, Any]:
    """Overwrite fields on an adaptation's next round."""
    result = copy.deepcopy(decision)
    result["nextRound"] = patch(result["nextRound"], **fields)
    return result


def with_extra_key(value: dict[str, Any], key: str, extra: Any = "smuggled") -> dict[str, Any]:
    """Smuggle an undeclared field into a strict object."""
    result = copy.deepcopy(value)
    result[key] = extra
    return result


def without_key(value: dict[str, Any], key: str) -> dict[str, Any]:
    result = copy.deepcopy(value)
    result.pop(key, None)
    return result


def with_rounds(plan: dict[str, Any], rounds: list[dict[str, Any]]) -> dict[str, Any]:
    result = copy.deepcopy(plan)
    result["rounds"] = copy.deepcopy(rounds)
    return result


def rebalance(plan: dict[str, Any], durations: tuple[int, int, int], rest: int) -> dict[str, Any]:
    """Set explicit round durations and rest, usually to break the 180-second budget."""
    result = copy.deepcopy(plan)
    for round_value, duration in zip(result["rounds"], durations):
        round_value["durationSeconds"] = duration
    result["restBetweenRoundsSeconds"] = rest
    return result


def scale_round(plan: dict[str, Any], index: int, range_scale: float) -> dict[str, Any]:
    return with_round(plan, index, rangeScale=range_scale)


def first_index_of(plan: dict[str, Any], movement: str) -> int | None:
    for index, round_value in enumerate(plan["rounds"]):
        if round_value["movementId"] == movement:
            return index
    return None


Path = tuple[Any, ...]


def numeric_diffs(base: Any, candidate: Any, prefix: Path = ()) -> list[tuple[Path, float, float]]:
    """Every numeric leaf that changed between two structures, with its path."""
    diffs: list[tuple[Path, float, float]] = []
    if isinstance(base, dict) and isinstance(candidate, dict):
        for key in sorted(base.keys() & candidate.keys(), key=str):
            diffs.extend(numeric_diffs(base[key], candidate[key], (*prefix, key)))
    elif isinstance(base, list) and isinstance(candidate, list) and len(base) == len(candidate):
        for index, (left, right) in enumerate(zip(base, candidate)):
            diffs.extend(numeric_diffs(left, right, (*prefix, index)))
    elif _numeric(base) and _numeric(candidate) and base != candidate:
        diffs.append((prefix, float(base), float(candidate)))
    return diffs


def _numeric(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def set_in(value: Any, path: Path, replacement: Any) -> Any:
    """Return a copy of ``value`` with ``path`` replaced."""
    result = copy.deepcopy(value)
    cursor = result
    for step in path[:-1]:
        cursor = cursor[step]
    cursor[path[-1]] = replacement
    return result


def get_in(value: Any, path: Path) -> Any:
    cursor = value
    for step in path:
        cursor = cursor[step]
    return cursor
