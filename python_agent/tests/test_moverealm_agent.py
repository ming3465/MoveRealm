from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from typing import Any

from python_agent.moverealm_agent import (
    PROJECT_ROOT,
    AgentToolError,
    MoveRealmPythonAgent,
    _candidate_snapshot,
    repository_provenance,
)


def report(
    *,
    eligible: bool,
    source: str = "codebuddy",
    fixture: str = "uncertain-room",
    score: int | None = 19,
    possible: int | None = 24,
    judge_status: str = "scored",
    context_sha256: str = "c" * 64,
) -> dict[str, Any]:
    return {
        "schemaVersion": "1.0.0",
        "observedAt": "2026-08-13T16:00:00.000Z",
        "fixtureId": fixture,
        "source": source,
        "inputSha256": "a" * 64,
        "candidateContextSha256": context_sha256,
        "deterministic": {"passed": eligible, "checks": []},
        "judge": {
            "status": judge_status,
            "modelDigest": "b" * 64 if judge_status == "scored" else None,
            "latencyMs": 123 if judge_status == "scored" else None,
            "verdict": {"private": "must not be copied"},
        },
        "totals": {
            "eligible": eligible,
            "advisoryEarned": score,
            "advisoryPossible": possible,
        },
    }


class FakeEvaluator:
    def __init__(self, reports: list[dict[str, Any]]) -> None:
        self.reports = reports
        self.calls: list[Path] = []

    def __call__(
        self,
        candidate: Path,
        _judge_mode: str,
        _model: str,
        _ollama_url: str,
        _strict_judge: bool,
    ) -> dict[str, Any]:
        self.calls.append(candidate)
        return self.reports.pop(0)


class MoveRealmPythonAgentTests(unittest.TestCase):
    def test_accepts_an_eligible_primary_without_touching_fallback(self) -> None:
        evaluator = FakeEvaluator([report(eligible=True, fixture="open-room", score=24)])
        result = MoveRealmPythonAgent(evaluator).run(
            Path("primary.json"), fallback_candidate=Path("fallback.json")
        )

        self.assertEqual(result["decision"], "accept_candidate")
        self.assertTrue(result["complete"])
        self.assertEqual(evaluator.calls, [Path("primary.json")])
        self.assertEqual(result["chosen"]["observedAt"], "2026-08-13T16:00:00.000Z")

    def test_model_score_cannot_rescue_an_ineligible_primary(self) -> None:
        evaluator = FakeEvaluator(
            [
                report(eligible=False, score=19),
                report(eligible=True, source="fallback", score=24),
            ]
        )
        result = MoveRealmPythonAgent(evaluator).run(
            Path("unsafe.json"), fallback_candidate=Path("safe.json")
        )

        self.assertEqual(result["decision"], "use_validated_fallback")
        self.assertTrue(result["complete"])
        self.assertFalse(result["evaluations"][0]["eligible"])
        self.assertEqual(result["evaluations"][0]["advisoryEarned"], 19)
        self.assertTrue(result["chosen"]["eligible"])

    def test_fails_closed_when_the_recovery_candidate_is_also_unsafe(self) -> None:
        evaluator = FakeEvaluator(
            [report(eligible=False), report(eligible=False, source="fallback")]
        )
        result = MoveRealmPythonAgent(evaluator).run(
            Path("unsafe.json"), fallback_candidate=Path("also-unsafe.json")
        )

        self.assertEqual(result["decision"], "reject_candidate")
        self.assertFalse(result["complete"])
        self.assertIsNone(result["chosen"])

    def test_strict_mode_requires_the_local_model_to_score(self) -> None:
        evaluator = FakeEvaluator(
            [report(eligible=True, judge_status="not_run", score=None, possible=None)]
        )
        result = MoveRealmPythonAgent(evaluator).run(
            Path("primary.json"), strict_judge=True
        )

        self.assertEqual(result["decision"], "accept_candidate")
        self.assertFalse(result["complete"])

    def test_output_omits_the_full_model_verdict(self) -> None:
        evaluator = FakeEvaluator([report(eligible=True, score=24)])
        result = MoveRealmPythonAgent(evaluator).run(Path("primary.json"))

        serialized = json.dumps(result)
        self.assertNotIn("must not be copied", serialized)
        self.assertFalse(result["rawModelOutputRetained"])

    def test_rejects_a_mismatched_fallback_fixture(self) -> None:
        evaluator = FakeEvaluator(
            [
                report(eligible=False, fixture="uncertain-room"),
                report(eligible=True, source="fallback", fixture="open-room"),
            ]
        )
        with self.assertRaisesRegex(AgentToolError, "does not match"):
            MoveRealmPythonAgent(evaluator).run(
                Path("unsafe.json"), fallback_candidate=Path("wrong-room.json")
            )

    def test_rejects_a_fallback_for_different_constraints_or_intent(self) -> None:
        evaluator = FakeEvaluator(
            [
                report(eligible=False, context_sha256="c" * 64),
                report(eligible=True, source="fallback", context_sha256="d" * 64),
            ]
        )
        with self.assertRaisesRegex(AgentToolError, "constraints, or user intent"):
            MoveRealmPythonAgent(evaluator).run(
                Path("unsafe.json"), fallback_candidate=Path("different-context.json")
            )

    def test_rejects_a_remote_ollama_origin_before_calling_the_evaluator(self) -> None:
        evaluator = FakeEvaluator([report(eligible=True)])
        with self.assertRaisesRegex(AgentToolError, "loopback"):
            MoveRealmPythonAgent(evaluator).run(
                Path("primary.json"), ollama_url="https://models.example.com"
            )
        self.assertEqual(evaluator.calls, [])

    def test_strict_judge_cannot_be_combined_with_no_judge(self) -> None:
        evaluator = FakeEvaluator([report(eligible=True)])
        with self.assertRaisesRegex(AgentToolError, "requires the ollama"):
            MoveRealmPythonAgent(evaluator).run(
                Path("primary.json"), judge_mode="none", strict_judge=True
            )
        self.assertEqual(evaluator.calls, [])

    def test_rejects_a_report_without_a_context_digest(self) -> None:
        broken = report(eligible=True)
        del broken["candidateContextSha256"]
        with self.assertRaisesRegex(AgentToolError, "context digest"):
            MoveRealmPythonAgent(FakeEvaluator([broken])).run(Path("primary.json"))


class CandidateSnapshotTests(unittest.TestCase):
    def test_repository_provenance_discloses_tree_and_dirty_state(self) -> None:
        provenance = repository_provenance()
        self.assertRegex(provenance["commit"], r"^[a-f0-9]{40}$")
        self.assertRegex(provenance["headTree"], r"^[a-f0-9]{40}$")
        self.assertIsInstance(provenance["dirty"], bool)
        self.assertRegex(provenance["statusSha256"], r"^[a-f0-9]{64}$")

    def test_context_digest_changes_with_user_intent_but_not_key_order(self) -> None:
        primary_path = PROJECT_ROOT / "artifacts/evaluation/candidates/uncertain-room-original.json"
        primary = json.loads(primary_path.read_text(encoding="utf-8"))
        with tempfile.TemporaryDirectory() as directory:
            reordered_path = Path(directory) / "reordered.json"
            reordered_path.write_text(json.dumps(primary, sort_keys=True), encoding="utf-8")
            changed_path = Path(directory) / "changed.json"
            primary["planRequest"]["intent"]["energy"] = "gentle"
            changed_path.write_text(json.dumps(primary), encoding="utf-8")

            original = _candidate_snapshot(primary_path, PROJECT_ROOT)
            reordered = _candidate_snapshot(reordered_path, PROJECT_ROOT)
            changed = _candidate_snapshot(changed_path, PROJECT_ROOT)

        self.assertEqual(original.context_sha256, reordered.context_sha256)
        self.assertNotEqual(original.context_sha256, changed.context_sha256)

    def test_fixture_integrity_failure_happens_before_any_model_tool(self) -> None:
        candidate_path = PROJECT_ROOT / "artifacts/evaluation/candidates/uncertain-room-original.json"
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "eval").mkdir()
            (root / "assets/room-fixtures").mkdir(parents=True)
            (root / "assets/room-fixtures/uncertain-room.png").write_bytes(b"tampered")
            manifest = json.loads((PROJECT_ROOT / "eval/fixtures.json").read_text(encoding="utf-8"))
            (root / "eval/fixtures.json").write_text(json.dumps(manifest), encoding="utf-8")

            with self.assertRaisesRegex(AgentToolError, "integrity check"):
                _candidate_snapshot(candidate_path, root)


if __name__ == "__main__":
    unittest.main()
