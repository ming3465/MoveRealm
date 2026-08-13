import unittest

from moverealm_probe.boundary import bisect
from moverealm_probe.fixtures import world
from moverealm_probe.operators import (
    first_index_of,
    get_in,
    numeric_diffs,
    patch,
    rebalance,
    set_in,
    with_extra_key,
    with_movement,
    with_round,
    without_key,
)


class OperatorTest(unittest.TestCase):
    def setUp(self) -> None:
        self.plan = world("tight").safe_plan()

    def test_mutations_never_touch_the_source(self) -> None:
        before = world("tight").safe_plan()
        with_round(self.plan, 0, rangeScale=0.99)
        with_movement(self.plan, 0, "squat")
        with_extra_key(self.plan, "extra", 1)
        without_key(self.plan, "safetyNote")
        rebalance(self.plan, (10, 10, 10), 0)
        self.assertEqual(self.plan, before)

    def test_with_movement_carries_the_matching_mechanic(self) -> None:
        mutated = with_movement(self.plan, 0, "side_step")
        self.assertEqual(mutated["rounds"][0]["mechanic"], "redirect_river")

    def test_with_movement_can_leave_a_mismatched_mechanic(self) -> None:
        mutated = with_movement(self.plan, 0, "side_step", keep_mechanic=True)
        self.assertEqual(mutated["rounds"][0]["mechanic"], "collect_fireflies")

    def test_first_index_of_finds_the_movement(self) -> None:
        self.assertEqual(first_index_of(self.plan, "side_step"), 2)
        self.assertIsNone(first_index_of(self.plan, "jump"))

    def test_patch_is_a_deep_copy(self) -> None:
        patched = patch(self.plan, title="Other")
        patched["rounds"][0]["rangeScale"] = 0.1
        self.assertNotEqual(self.plan["rounds"][0]["rangeScale"], 0.1)


class DiffTest(unittest.TestCase):
    def setUp(self) -> None:
        self.plan = world("tight").safe_plan()

    def test_a_single_numeric_change_is_located(self) -> None:
        mutated = with_round(self.plan, 1, rangeScale=0.95)
        diffs = numeric_diffs(self.plan, mutated)
        self.assertEqual(len(diffs), 1)
        path, before, after = diffs[0]
        self.assertEqual(path, ("rounds", 1, "rangeScale"))
        self.assertEqual((before, after), (0.64, 0.95))

    def test_non_numeric_changes_are_ignored(self) -> None:
        self.assertEqual(numeric_diffs(self.plan, patch(self.plan, title="Other")), [])

    def test_set_in_and_get_in_round_trip(self) -> None:
        path = ("rounds", 2, "tempo")
        updated = set_in(self.plan, path, 1.1)
        self.assertEqual(get_in(updated, path), 1.1)
        self.assertNotEqual(get_in(self.plan, path), 1.1)


class BisectTest(unittest.TestCase):
    def test_a_known_threshold_is_located(self) -> None:
        result = bisect(lambda value: value <= 0.62, 0.4, 1.0)
        self.assertEqual(result.status, "measured")
        self.assertLessEqual(result.accepted_max, 0.62)
        self.assertGreaterEqual(result.rejected_min, 0.62)
        self.assertLess(result.rejected_min - result.accepted_max, 0.01)

    def test_integer_thresholds_land_on_whole_numbers(self) -> None:
        result = bisect(lambda value: value <= 16, 3, 48, integer=True)
        self.assertEqual((result.accepted_max, result.rejected_min), (16, 17))

    def test_a_permissive_parameter_is_reported_not_bisected(self) -> None:
        result = bisect(lambda _value: True, 0.4, 1.0)
        self.assertEqual(result.status, "extreme_end_accepted")

    def test_a_rejected_conservative_end_is_reported(self) -> None:
        result = bisect(lambda _value: False, 0.4, 1.0)
        self.assertEqual(result.status, "conservative_end_rejected")

    def test_the_call_budget_is_respected(self) -> None:
        result = bisect(lambda value: value <= 0.62, 0.4, 1.0, tolerance=1e-9, max_calls=8)
        self.assertLessEqual(result.calls, 8)


if __name__ == "__main__":
    unittest.main()
