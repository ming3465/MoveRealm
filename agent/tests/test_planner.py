import unittest
from unittest.mock import patch

from moverealm_probe.fixtures import world
from moverealm_probe.planner import DeterministicPlanner, OllamaPlanner, PlannerContext

PLAN = world("tight").safe_plan()


class ModelProposalTest(unittest.TestCase):
    """Small models get the shape right and the spelling wrong; the address is repaired, not the value."""

    def apply(self, path, value):
        return OllamaPlanner._apply(PLAN, {"path": path, "value": value})

    def test_a_well_formed_path_is_applied(self) -> None:
        candidate = self.apply(["rounds", 0, "rangeScale"], 0.99)
        self.assertEqual(candidate["rounds"][0]["rangeScale"], 0.99)

    def test_a_wrapper_key_is_stripped(self) -> None:
        candidate = self.apply(["plan", "rounds", 0, "rangeScale"], 0.99)
        self.assertEqual(candidate["rounds"][0]["rangeScale"], 0.99)

    def test_a_string_round_index_is_coerced(self) -> None:
        candidate = self.apply(["rounds", "2", "rangeScale"], 0.99)
        self.assertEqual(candidate["rounds"][2]["rangeScale"], 0.99)

    def test_a_top_level_field_is_applied(self) -> None:
        self.assertEqual(self.apply(["restBetweenRoundsSeconds"], 19)["restBetweenRoundsSeconds"], 19)

    def test_an_unknown_field_is_dropped(self) -> None:
        self.assertIsNone(self.apply(["rounds", 0, "difficulty"], 9))

    def test_an_out_of_bounds_round_is_dropped(self) -> None:
        self.assertIsNone(self.apply(["rounds", 7, "rangeScale"], 0.9))

    def test_a_no_op_edit_is_dropped(self) -> None:
        self.assertIsNone(self.apply(["rounds", 0, "rangeScale"], PLAN["rounds"][0]["rangeScale"]))

    def test_a_malformed_path_is_dropped(self) -> None:
        self.assertIsNone(self.apply("rounds.0.rangeScale", 0.9))
        self.assertIsNone(self.apply([], 0.9))
        self.assertIsNone(self.apply(["rounds", 0, "rangeScale", "deep", "deeper"], 0.9))

    def test_the_source_plan_is_never_mutated(self) -> None:
        before = world("tight").safe_plan()
        self.apply(["rounds", 0, "rangeScale"], 0.99)
        self.assertEqual(PLAN, before)


class UnavailableModelTest(unittest.TestCase):
    def test_a_remote_model_origin_is_refused_without_network_access(self) -> None:
        planner = OllamaPlanner(DeterministicPlanner(), base_url="https://models.example.com")
        with patch("moverealm_probe.planner.urllib.request.urlopen") as urlopen:
            self.assertEqual(planner.preflight(), "invalid")
        urlopen.assert_not_called()
        self.assertIn("loopback", planner.detail)

    def test_an_unreachable_model_degrades_to_deterministic_planning(self) -> None:
        planner = OllamaPlanner(DeterministicPlanner(), base_url="http://127.0.0.1:9")
        self.assertEqual(planner.preflight(), "not_run")
        self.assertIn("unavailable", planner.detail)

        context = PlannerContext(round_index=1, worlds=(world("tight"),))
        deterministic = DeterministicPlanner().propose(context)
        self.assertEqual(len(planner.propose(context)), len(deterministic))

    def test_the_model_is_only_consulted_in_early_rounds(self) -> None:
        planner = OllamaPlanner(DeterministicPlanner(), last_model_round=2)
        planner.status = "active"
        calls: list[int] = []
        planner._model_probes = lambda _world, context: calls.append(context.round_index) or []

        for round_index in range(5):
            planner.propose(PlannerContext(round_index=round_index, worlds=(world("tight"),)))
        self.assertEqual(calls, [1, 2])


if __name__ == "__main__":
    unittest.main()
