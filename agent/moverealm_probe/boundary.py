"""Binary search for the accept/reject frontier of a single numeric parameter.

Catalogue probes prove a rule fires. Bisection measures *where* it fires, which is the part a
reader cannot get from the source without running it: the report can then say the narrow side-step
cap was observed between two concrete values rather than merely "enforced".
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable


@dataclass(frozen=True)
class Bisection:
    status: str  # measured | conservative_end_rejected | extreme_end_accepted
    accepted_max: float | None
    rejected_min: float | None
    detail: str
    calls: int


def bisect(
    evaluate: Callable[[float], bool],
    low: float,
    high: float,
    tolerance: float = 0.005,
    integer: bool = False,
    max_calls: int = 24,
) -> Bisection:
    """Find the boundary between an accepted ``low`` and a rejected ``high``.

    The search assumes the gate is monotonic in this parameter. Both endpoints are tested first, so
    a non-monotonic or entirely permissive parameter is reported rather than silently bisected.
    """
    calls = 0

    def probe(value: float) -> bool:
        nonlocal calls
        calls += 1
        return evaluate(value)

    def tidy(value: float) -> float:
        return int(round(value)) if integer else round(value, 4)

    low, high = tidy(low), tidy(high)

    if not probe(low):
        return Bisection("conservative_end_rejected", None, low, f"The conservative value {low} was refused.", calls)
    if probe(high):
        return Bisection("extreme_end_accepted", high, None, f"The extreme value {high} was accepted.", calls)

    step = 1.0 if integer else tolerance
    while high - low > step and calls < max_calls:
        middle = tidy((low + high) / 2)
        if middle <= low or middle >= high:
            break
        if probe(middle):
            low = middle
        else:
            high = middle

    return Bisection("measured", low, high, f"Accepted up to {low}; refused from {high}.", calls)
