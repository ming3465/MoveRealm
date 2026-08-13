import unittest

from moverealm_probe.agent import SafetyProbeAgent
from moverealm_probe.cli import EXIT_UNAVAILABLE, _exit_code
from moverealm_probe.fixtures import WORLDS, world
from moverealm_probe.types import (
    Frontier,
    STATUS_BREACH,
    STATUS_INCONCLUSIVE,
    STATUS_OVER_REJECTION,
    Verdict,
)

from tests.stubs import FaithfulGate, LeakyGate, ParanoidGate, PermissiveGate, UnreachableGate

SMALL = (world("tight"), world("uncertain"))


def run_against(gate, **options):
    agent = SafetyProbeAgent(gate=gate, worlds=options.pop("worlds", SMALL), **options)
    return agent.run()


class FalsifiabilityTest(unittest.TestCase):
    """A clean report is only meaningful if a dirty gate would produce a dirty one."""

    def test_a_gate_that_accepts_everything_produces_breaches(self) -> None:
        run = run_against(PermissiveGate(), measure_boundaries=False, max_rounds=2)
        self.assertGreater(len(run.findings), 0)
        self.assertTrue(all(finding.status == STATUS_BREACH for finding in run.findings))
        self.assertTrue(run.controls_passed, "compliant baselines are still accepted by a permissive gate")

    def test_a_gate_that_refuses_everything_fails_its_controls(self) -> None:
        run = run_against(ParanoidGate(), measure_boundaries=False, max_rounds=1)
        self.assertFalse(run.controls_passed)
        self.assertTrue(any(finding.status == STATUS_OVER_REJECTION for finding in run.findings))

    def test_a_faithful_gate_produces_no_findings(self) -> None:
        run = run_against(FaithfulGate(), measure_boundaries=False, max_rounds=3)
        self.assertEqual(run.findings, [])
        self.assertTrue(run.controls_passed)
        self.assertGreater(run.stats.probes, 50)

    def test_a_single_missing_rule_is_caught(self) -> None:
        run = run_against(LeakyGate(), measure_boundaries=False, max_rounds=2)
        breached = {rule for finding in run.findings for rule in finding.ruling.violated}
        self.assertIn("plan.side_step_narrow_envelope", breached)

    def test_an_unreachable_gate_is_never_reported_as_defended(self) -> None:
        run = run_against(UnreachableGate(), measure_boundaries=True, max_rounds=1)
        self.assertEqual(run.findings, [])
        self.assertTrue(all(outcome.status == STATUS_INCONCLUSIVE for outcome in run.outcomes))
        self.assertFalse(run.controls_passed)
        self.assertEqual(_exit_code(run, None, None), EXIT_UNAVAILABLE)
        self.assertTrue(run.frontiers)
        self.assertTrue(all(frontier.status == "inconclusive" for frontier in run.frontiers))

    def test_an_internal_gate_error_is_inconclusive(self) -> None:
        verdict = Verdict(False, "internal", "Unexpected gate error.")
        self.assertFalse(verdict.reached_gate)

    def test_a_boundary_only_transport_failure_is_unavailable(self) -> None:
        run = run_against(FaithfulGate(), measure_boundaries=False, max_rounds=1)
        run.frontiers = [
            Frontier(
                name="Test boundary",
                parameter="rangeScale",
                world="tight",
                documented_threshold=0.62,
                accepted_max=None,
                rejected_min=None,
                status="inconclusive",
                detail="Transport stopped during measurement.",
            )
        ]
        self.assertEqual(_exit_code(run, None, None), EXIT_UNAVAILABLE)


class LoopTest(unittest.TestCase):
    def test_the_loop_stops_when_nothing_new_appears(self) -> None:
        run = run_against(FaithfulGate(), measure_boundaries=False, max_rounds=25, quiet_rounds=2)
        self.assertEqual(run.termination, "no_new_probes")

    def test_no_candidate_is_probed_twice(self) -> None:
        run = run_against(FaithfulGate(), measure_boundaries=False, max_rounds=6)
        keys = [outcome.probe.key() for outcome in run.outcomes]
        self.assertEqual(len(keys), len(set(keys)))

    def test_every_world_and_surface_is_covered(self) -> None:
        run = run_against(FaithfulGate(), measure_boundaries=False, max_rounds=1, worlds=WORLDS)
        self.assertEqual({outcome.probe.world for outcome in run.outcomes}, {item.name for item in WORLDS})
        self.assertEqual({outcome.probe.surface for outcome in run.outcomes}, {"scene", "plan", "adapt"})

    def test_escalation_reacts_to_the_previous_round(self) -> None:
        run = run_against(FaithfulGate(), measure_boundaries=False, max_rounds=4)
        origins = {outcome.probe.origin for outcome in run.outcomes}
        self.assertIn("escalation", origins)
        self.assertIn("combination", origins)
        self.assertIn("control", origins)


class BoundaryTest(unittest.TestCase):
    def test_frontiers_are_measured_against_a_faithful_gate(self) -> None:
        run = run_against(FaithfulGate(), max_rounds=1)
        measured = [frontier for frontier in run.frontiers if frontier.status == "measured"]
        self.assertGreater(len(measured), 0)
        for frontier in measured:
            self.assertIsNot(frontier.matches_documented, False, f"{frontier.name} disagreed with the docs")


if __name__ == "__main__":
    unittest.main()
