import unittest
from typing import Any

from moverealm_probe.fixtures import world
from moverealm_probe.cli import EXIT_UNAVAILABLE, _exit_code
from moverealm_probe.gate import GateUnavailable
from moverealm_probe.live import audit_live
from moverealm_probe.operators import with_round

WORLDS = (world("tight"),)


class StubClient:
    """A stand-in adapter whose plan and adaptation responses the test controls."""

    kind = "stub-http"

    def __init__(self, plan_response=None, adapt_response=None, refuse_codes=None) -> None:
        self.base_url = "http://stub"
        self._plan_response = plan_response
        self._adapt_response = adapt_response
        self._refuse_codes = refuse_codes or {}
        self.seen: list[dict[str, Any]] = []

    def health(self) -> dict[str, Any]:
        return {"ok": True, "product": "MoveRealm", "movementDirector": "fallback", "codeBuddyConnected": False}

    def plan(self, request):
        self.seen.append(request)
        if not request.get("constraints", {}).get("floorClear", True):
            return 422, {"error": "Confirm the floor."}, 1.0
        if request.get("coachingMode") or request.get("intent", {}).get("noJumping") is False:
            return 400, {"error": "Invalid."}, 1.0
        if request.get("intent", {}).get("durationSeconds") != 180:
            return 400, {"error": "Invalid."}, 1.0
        if "diagonal" in request.get("constraints", {}).get("permittedDirections", []):
            return 400, {"error": "Invalid."}, 1.0
        plan = self._plan_response or world("tight").safe_plan()
        return 200, {"data": plan, "meta": {"source": "fallback", "label": "Deterministic fallback", "latencyMs": 1}}, 1.0

    def adapt(self, request):
        telemetry = request.get("telemetry", {})
        if telemetry.get("targetsCompleted", 0) > telemetry.get("targetsPresented", 0):
            return 400, {"error": "Invalid telemetry."}, 1.0
        seed = request["nextRoundSeed"]
        decision = self._adapt_response or {
            "nextRound": {**seed, "rangeScale": round(seed["rangeScale"] - 0.16, 4), "tempo": round(seed["tempo"] - 0.13, 4)},
            "reason": "Reducing the envelope after a hard round.",
            "adjustments": ["target_envelope", "tempo"],
        }
        return 200, {"data": decision, "meta": {"source": "fallback", "label": "Deterministic fallback", "latencyMs": 1}}, 1.0


class UnreachableClient:
    kind = "stub-http"
    base_url = "http://stub"

    def health(self):
        raise GateUnavailable("nothing is listening")


class LiveAuditTest(unittest.TestCase):
    def test_a_compliant_adapter_passes_every_check(self) -> None:
        run = audit_live(StubClient(), WORLDS)
        self.assertEqual(run.failures, [], [check.name for check in run.failures])
        self.assertEqual(run.inconclusive, [])

    def test_a_returned_plan_that_breaks_the_room_envelope_is_caught(self) -> None:
        unsafe = with_round(world("tight").safe_plan(), 2, rangeScale=0.95)
        run = audit_live(StubClient(plan_response=unsafe), WORLDS)
        names = [check.name for check in run.failures]
        self.assertIn("Returned plan satisfies the documented rules", names)

    def test_a_returned_plan_that_misses_the_time_budget_is_caught(self) -> None:
        stretched = world("tight").safe_plan()
        stretched["rounds"][0]["durationSeconds"] = 80
        run = audit_live(StubClient(plan_response=stretched), WORLDS)
        names = [check.name for check in run.failures]
        self.assertIn("Returned plan totals exactly 180 seconds", names)

    def test_an_adaptation_that_swaps_the_movement_is_caught(self) -> None:
        seed = WORLDS[0].adapt_request(feedback="too_hard")["nextRoundSeed"]
        swapped = {
            "nextRound": {**seed, "movementId": "side_step", "mechanic": "redirect_river", "rangeScale": 0.5},
            "reason": "Switching movement.",
            "adjustments": ["target_envelope"],
        }
        run = audit_live(StubClient(adapt_response=swapped), WORLDS)
        names = [check.name for check in run.failures]
        self.assertIn("Returned adaptation satisfies the documented rules", names)

    def test_an_unreachable_adapter_is_inconclusive_not_a_pass(self) -> None:
        run = audit_live(UnreachableClient(), WORLDS)
        self.assertEqual(run.failures, [])
        self.assertEqual(len(run.inconclusive), 1)
        self.assertEqual(_exit_code(None, run, None), EXIT_UNAVAILABLE)


if __name__ == "__main__":
    unittest.main()
