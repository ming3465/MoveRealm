import json
import tempfile
import unittest
from pathlib import Path

from moverealm_probe.agent import SafetyProbeAgent
from moverealm_probe.fixtures import world
from moverealm_probe.live import Check, LiveRun
from moverealm_probe.report import (
    build_report,
    render_console,
    render_markdown,
    repo_provenance,
    write_outputs,
)

from tests.stubs import FaithfulGate, PermissiveGate

REPO_ROOT = Path(__file__).resolve().parents[2]
SMALL = (world("tight"),)


def sample_run(gate):
    return SafetyProbeAgent(gate=gate, worlds=SMALL, max_rounds=2, measure_boundaries=True).run()


class ReportTest(unittest.TestCase):
    def test_repository_provenance_discloses_commit_tree_and_dirty_state(self) -> None:
        provenance = repo_provenance(REPO_ROOT)
        self.assertRegex(provenance["commit"], r"^[a-f0-9]{40}$")
        self.assertRegex(provenance["headTree"], r"^[a-f0-9]{40}$")
        self.assertIsInstance(provenance["dirty"], bool)
        self.assertIsInstance(provenance["statusEntryCount"], int)
        self.assertRegex(provenance["statusSha256"], r"^[a-f0-9]{64}$")

    def test_a_clean_run_reports_no_findings(self) -> None:
        report = build_report(sample_run(FaithfulGate()), None, "contracts", REPO_ROOT)
        self.assertEqual(report["totals"]["breaches"], 0)
        self.assertEqual(report["findings"], [])
        self.assertTrue(report["controls"]["passed"])
        self.assertGreater(report["totals"]["probes"], 0)

    def test_findings_carry_their_documented_citation(self) -> None:
        report = build_report(sample_run(PermissiveGate()), None, "contracts", REPO_ROOT)
        self.assertGreater(len(report["findings"]), 0)
        finding = report["findings"][0]
        self.assertTrue(finding["rules"])
        for rule in finding["rules"]:
            self.assertIn(rule["tier"], ("documented", "specified", "derived"))
            self.assertTrue(rule["source"])

    def test_the_report_is_json_serialisable(self) -> None:
        report = build_report(sample_run(PermissiveGate()), None, "contracts", REPO_ROOT)
        self.assertIsInstance(json.dumps(report), str)

    def test_scope_and_privacy_are_always_stated(self) -> None:
        report = build_report(sample_run(FaithfulGate()), None, "contracts", REPO_ROOT)
        self.assertIn("not a human trial", report["scope"])
        self.assertIn("No participant data", report["privacy"])

    def test_frontiers_are_included(self) -> None:
        report = build_report(sample_run(FaithfulGate()), None, "contracts", REPO_ROOT)
        self.assertTrue(report["frontiers"])

    def test_renderers_produce_text(self) -> None:
        report = build_report(sample_run(FaithfulGate()), None, "contracts", REPO_ROOT)
        console = render_console(report)
        markdown = render_markdown(report)
        self.assertIn("MoveRealm safety probe", console)
        self.assertIn("worktree", console)
        self.assertIn("## Invariant coverage", markdown)
        self.assertIn("Repository worktree", markdown)
        self.assertIn("## Scope and privacy", markdown)

    def test_live_checks_render(self) -> None:
        live = LiveRun(
            base_url="http://127.0.0.1:4173",
            health={"ok": True, "movementDirector": "fallback"},
            checks=[
                Check("Adapter health", "pass", "ok", endpoint="/api/health"),
                Check("Returned plan satisfies the documented rules", "fail", "bad", "tight", "/api/quest/plan"),
            ],
        )
        report = build_report(None, live, "live", REPO_ROOT)
        self.assertEqual(report["live"]["failures"], 1)
        self.assertIn("Live adapter", render_console(report))
        self.assertIn("## Live adapter audit", render_markdown(report))

    def test_outputs_are_written(self) -> None:
        report = build_report(sample_run(FaithfulGate()), None, "contracts", REPO_ROOT)
        with tempfile.TemporaryDirectory() as directory:
            written = write_outputs(report, Path(directory))
            self.assertEqual(len(written), 2)
            for path in written:
                self.assertTrue(path.exists())
                self.assertTrue(path.read_text(encoding="utf-8").strip())


if __name__ == "__main__":
    unittest.main()
