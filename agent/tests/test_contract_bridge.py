"""Integration checks against the real Zod contracts through the Node bridge.

Skipped automatically when the repository's Node dependencies are not installed, so the rest of the
suite still runs on a bare Python environment.
"""

import unittest
from pathlib import Path

from moverealm_probe.fixtures import safe_adaptation, world
from moverealm_probe.gate import ContractGate, GateUnavailable
from moverealm_probe.operators import patch, with_extra_key, with_movement, with_round

REPO_ROOT = Path(__file__).resolve().parents[2]
BRIDGE_AVAILABLE = (REPO_ROOT / "node_modules" / ".bin" / "tsx").exists() and (
    REPO_ROOT / "agent" / "bridge" / "contract_bridge.ts"
).exists()


@unittest.skipUnless(BRIDGE_AVAILABLE, "Run `npm install` to exercise the real contract bridge.")
class ContractBridgeTest(unittest.TestCase):
    gate: ContractGate

    @classmethod
    def setUpClass(cls) -> None:
        cls.gate = ContractGate(REPO_ROOT)
        try:
            cls.gate.start()
        except GateUnavailable as error:  # pragma: no cover - environment dependent
            raise unittest.SkipTest(str(error)) from error

    @classmethod
    def tearDownClass(cls) -> None:
        cls.gate.close()

    def test_the_bridge_reports_its_version(self) -> None:
        self.assertIn("bridgeVersion", self.gate.info)

    def test_every_compliant_baseline_is_accepted(self) -> None:
        for name in ("open", "tight", "uncertain", "no_lateral", "no_vertical"):
            item = world(name)
            with self.subTest(world=name):
                self.assertTrue(self.gate.validate("scene", item.scene).accepted)
                verdict = self.gate.validate("plan", item.safe_plan(), item.plan_request())
                self.assertTrue(verdict.accepted, verdict.message)

    def test_a_narrow_room_refuses_a_wide_side_step(self) -> None:
        item = world("tight")
        verdict = self.gate.validate("plan", with_round(item.safe_plan(), 2, rangeScale=0.95), item.plan_request())
        self.assertFalse(verdict.accepted)
        self.assertEqual(verdict.kind, "safety")

    def test_an_uncertain_room_refuses_a_squat(self) -> None:
        item = world("uncertain")
        verdict = self.gate.validate("plan", with_movement(item.safe_plan(), 0, "squat"), item.plan_request())
        self.assertFalse(verdict.accepted)

    def test_a_smuggled_field_is_a_schema_rejection(self) -> None:
        item = world("open")
        verdict = self.gate.validate(
            "plan", with_extra_key(item.safe_plan(), "difficultyMultiplier", 3), item.plan_request()
        )
        self.assertFalse(verdict.accepted)
        self.assertEqual(verdict.kind, "schema")

    def test_an_adaptation_may_not_replace_the_movement(self) -> None:
        item = world("open")
        request = item.adapt_request()
        decision = safe_adaptation(request)
        decision["nextRound"] = patch(decision["nextRound"], movementId="squat", mechanic="shelter_seedlings")
        verdict = self.gate.validate("adapt", decision, request)
        self.assertFalse(verdict.accepted)

    def test_a_malformed_request_is_reported_as_our_fault(self) -> None:
        item = world("open")
        broken = patch(item.plan_request(), constraints={"floorClear": True})
        verdict = self.gate.validate("plan", item.safe_plan(), broken)
        self.assertEqual(verdict.kind, "request_invalid")

    def test_the_production_fallback_plan_is_itself_accepted(self) -> None:
        for name in ("open", "tight", "uncertain", "no_lateral", "no_vertical"):
            item = world(name)
            with self.subTest(world=name):
                fallback = self.gate.production_fallback("plan", item.plan_request())
                self.assertIsNotNone(fallback)
                verdict = self.gate.validate("plan", fallback, item.plan_request())
                self.assertTrue(verdict.accepted, verdict.message)


if __name__ == "__main__":
    unittest.main()
