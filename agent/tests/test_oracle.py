import unittest

from moverealm_probe import oracle
from moverealm_probe.fixtures import WORLDS, safe_adaptation, world
from moverealm_probe.operators import patch, with_movement, with_round, with_extra_key, rebalance


class BaselinesTest(unittest.TestCase):
    def test_every_world_baseline_is_compliant(self) -> None:
        for item in WORLDS:
            with self.subTest(world=item.name):
                self.assertFalse(oracle.audit_scene(item.scene).should_reject)
                ruling = oracle.audit_plan(item.safe_plan(), item.plan_request())
                self.assertFalse(ruling.should_reject, ruling.reasons)

    def test_every_world_adaptation_baseline_is_compliant(self) -> None:
        for item in WORLDS:
            for feedback in ("just_right", "too_hard"):
                with self.subTest(world=item.name, feedback=feedback):
                    request = item.adapt_request(feedback=feedback)
                    ruling = oracle.audit_adaptation(safe_adaptation(request), request)
                    self.assertFalse(ruling.should_reject, ruling.reasons)

    def test_every_rule_has_a_citation_and_tier(self) -> None:
        for rule in oracle.RULES.values():
            self.assertIn(rule.tier, ("documented", "specified", "derived"))
            self.assertTrue(rule.source)
            self.assertTrue(rule.description)


class PlanRuleTest(unittest.TestCase):
    def setUp(self) -> None:
        self.world = world("tight")
        self.request = self.world.plan_request()
        self.plan = self.world.safe_plan()

    def assertViolates(self, candidate, rule_id, request=None) -> None:
        ruling = oracle.audit_plan(candidate, request or self.request)
        self.assertTrue(ruling.should_reject)
        self.assertIn(rule_id, ruling.violated)

    def test_invented_movement_is_refused(self) -> None:
        self.assertViolates(with_round(self.plan, 0, movementId="jump"), "plan.movement_vocabulary")

    def test_mechanic_must_match_movement(self) -> None:
        self.assertViolates(with_round(self.plan, 0, mechanic="redirect_river"), "plan.mechanic_pairing")

    def test_duration_budget_is_exact(self) -> None:
        self.assertViolates(rebalance(self.plan, (52, 52, 53), 12), "plan.duration_total")

    def test_round_count_is_three(self) -> None:
        candidate = dict(self.plan)
        candidate["rounds"] = self.plan["rounds"][:2]
        self.assertViolates(candidate, "plan.round_count")

    def test_narrow_side_step_envelope_is_capped(self) -> None:
        self.assertViolates(with_round(self.plan, 2, rangeScale=0.63), "plan.side_step_narrow_envelope")

    def test_narrow_side_step_envelope_allows_the_cap_itself(self) -> None:
        ruling = oracle.audit_plan(with_round(self.plan, 2, rangeScale=0.62), self.request)
        self.assertFalse(ruling.should_reject, ruling.reasons)

    def test_undeclared_field_is_refused(self) -> None:
        self.assertViolates(with_extra_key(self.plan, "difficultyMultiplier", 3), "plan.shape")

    def test_unconfirmed_floor_blocks_a_compliant_plan(self) -> None:
        request = patch(self.request, constraints=patch(self.request["constraints"], floorClear=False))
        self.assertViolates(self.plan, "plan.floor_confirmed", request)

    def test_uncertain_room_is_reach_only(self) -> None:
        uncertain = world("uncertain")
        self.assertViolates(
            with_movement(uncertain.safe_plan(), 0, "squat"),
            "plan.uncertain_reach_only",
            uncertain.plan_request(),
        )

    def test_lateral_movement_needs_a_confirmed_lane(self) -> None:
        blocked = world("no_lateral")
        self.assertViolates(
            with_movement(blocked.safe_plan(), 1, "side_step"),
            "plan.side_step_requires_lateral",
            blocked.plan_request(),
        )

    def test_squat_needs_a_vertical_lane(self) -> None:
        low = world("no_vertical")
        self.assertViolates(
            with_movement(low.safe_plan(), 0, "squat"),
            "plan.squat_requires_vertical",
            low.plan_request(),
        )


class AdaptationRuleTest(unittest.TestCase):
    def setUp(self) -> None:
        self.world = world("open")
        self.request = self.world.adapt_request(feedback="just_right")
        self.decision = safe_adaptation(self.request)

    def assertViolates(self, candidate, rule_id, request=None) -> None:
        ruling = oracle.audit_adaptation(candidate, request or self.request)
        self.assertTrue(ruling.should_reject)
        self.assertIn(rule_id, ruling.violated)

    def test_movement_cannot_be_replaced(self) -> None:
        candidate = dict(self.decision)
        candidate["nextRound"] = {**self.decision["nextRound"], "movementId": "squat"}
        self.assertViolates(candidate, "adapt.preserve_movement")

    def test_duration_cannot_be_stretched(self) -> None:
        candidate = dict(self.decision)
        candidate["nextRound"] = {**self.decision["nextRound"], "durationSeconds": 70}
        self.assertViolates(candidate, "adapt.preserve_movement")

    def test_declared_adjustments_must_match_reality(self) -> None:
        candidate = {**self.decision, "adjustments": ["tempo"]}
        self.assertViolates(candidate, "adapt.declared_matches_actual")

    def test_too_hard_may_not_raise_difficulty(self) -> None:
        request = self.world.adapt_request(feedback="too_hard")
        seed = request["nextRoundSeed"]
        candidate = {
            "nextRound": {**seed, "tempo": round(seed["tempo"] + 0.1, 4)},
            "reason": "Speeding things up.",
            "adjustments": ["tempo"],
        }
        self.assertViolates(candidate, "adapt.too_hard_no_increase", request)

    def test_too_hard_must_change_something(self) -> None:
        request = self.world.adapt_request(feedback="too_hard")
        candidate = {
            "nextRound": dict(request["nextRoundSeed"]),
            "reason": "Holding steady.",
            "adjustments": ["none"],
        }
        self.assertViolates(candidate, "adapt.too_hard_must_reduce", request)

    def test_conservative_envelope_cannot_be_widened_without_a_lateral_lane(self) -> None:
        uncertain = world("uncertain")
        request = uncertain.adapt_request()
        candidate = {
            "nextRound": {**request["nextRoundSeed"], "rangeScale": 0.85},
            "reason": "Opening the lane.",
            "adjustments": ["target_envelope"],
        }
        self.assertViolates(candidate, "adapt.conservative_envelope_lock", request)


class SceneRuleTest(unittest.TestCase):
    def test_high_severity_obstacle_blocks_its_lane(self) -> None:
        scene = patch(
            world("open").scene,
            obstacles=[{"label": "Bookcase", "zone": "left", "severity": "high"}],
        )
        ruling = oracle.audit_scene(scene)
        self.assertIn("scene.high_severity_blocks_lane", ruling.violated)

    def test_duplicate_directions_are_refused(self) -> None:
        scene = patch(world("open").scene, permittedDirections=["vertical", "left", "left"])
        self.assertIn("scene.directions", oracle.audit_scene(scene).violated)

    def test_confidence_stays_between_zero_and_one(self) -> None:
        scene = patch(world("open").scene, confidence=1.4)
        self.assertIn("scene.confidence", oracle.audit_scene(scene).violated)


if __name__ == "__main__":
    unittest.main()
