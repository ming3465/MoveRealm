"""Stub gates used to prove the harness itself can tell right from wrong."""

from __future__ import annotations

from typing import Any

from moverealm_probe import oracle
from moverealm_probe.types import Verdict


class PermissiveGate:
    """Accepts everything. A correct harness must report breaches against it."""

    kind = "stub-permissive"

    def validate(self, surface: str, candidate: Any, request: dict[str, Any] | None = None) -> Verdict:
        return Verdict(True, "accepted", "", (), 0.0)


class ParanoidGate:
    """Refuses everything, including compliant quests."""

    kind = "stub-paranoid"

    def validate(self, surface: str, candidate: Any, request: dict[str, Any] | None = None) -> Verdict:
        return Verdict(False, "safety", "This gate refuses everything.", (), 0.0)


class FaithfulGate:
    """Agrees with the documented-rule oracle exactly. No findings should be reported."""

    kind = "stub-faithful"

    def validate(self, surface: str, candidate: Any, request: dict[str, Any] | None = None) -> Verdict:
        ruling = oracle.audit(surface, candidate, request)
        if ruling.should_reject:
            return Verdict(False, "safety", "; ".join(ruling.reasons), (), 0.0)
        return Verdict(True, "accepted", "", (), 0.0)


class UnreachableGate:
    """Never answers. Every probe must be inconclusive, never 'defended'."""

    kind = "stub-unreachable"

    def validate(self, surface: str, candidate: Any, request: dict[str, Any] | None = None) -> Verdict:
        return Verdict(False, "transport", "The gate is unreachable.", (), 0.0)


class LeakyGate(FaithfulGate):
    """Faithful except that it forgets the narrow side-step cap: a single planted regression."""

    kind = "stub-leaky"

    def validate(self, surface: str, candidate: Any, request: dict[str, Any] | None = None) -> Verdict:
        ruling = oracle.audit(surface, candidate, request)
        remaining = [rule for rule in ruling.violated if rule != "plan.side_step_narrow_envelope"]
        if remaining:
            return Verdict(False, "safety", "; ".join(ruling.reasons), (), 0.0)
        return Verdict(True, "accepted", "", (), 0.0)
