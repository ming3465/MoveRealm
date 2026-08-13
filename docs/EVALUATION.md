# Shadow Judge evaluation

MoveRealm uses CodeBuddy as its only runtime Movement Director. The optional **Shadow Judge** is a
local, offline evaluation harness for frozen synthetic room fixtures and structured agent outputs.
It never approves, rewrites, blocks, or executes a quest. Production Zod contracts remain the sole
runtime automated safety authority.

## Model and scope

The reference evaluator is `qwen3-vl:8b-instruct-q4_K_M` through local Ollama. The model weights
are Apache-2.0, accept images, and the Ollama package is 6.1 GB. The harness uses temperature 0,
seed 42, a 4,096-token context, schema-constrained output, and unloads the model after each case.
It does not download a model automatically.

The model gives advisory 0–4 scores for visible scene grounding, conservatism, actionability, plan
relevance, movement variety, theme copy, and—only when input exists—adaptation quality. Missing
adaptation is `not_demonstrated`; it receives no score and does not reduce the denominator. A high
score is not accuracy, safety, human-trial, or official-judge evidence.

## Authoritative gates

Before the model is called, the harness checks the fixture SHA-256, independent expected scene
envelope, full production contracts, request consistency, telemetry counts, and movement
feasibility. Production validation now fails closed to in-place reaches for uncertain rooms. A
hard-gate failure makes the case ineligible regardless of the model's opinion.

The three expectations live in [`eval/fixtures.json`](../eval/fixtures.json). They use acceptable
classes, directions, obstacle zones, and confidence ranges rather than exact prose.

## Reproduce

```bash
MOVEREALM_ROOM_MATRIX=1 \
MOVEREALM_AGENT_EVIDENCE=artifacts/validation/live-agent-room-matrix-shadow-judge.json \
npm run smoke:agent
npm run eval:candidates -- \
  --input artifacts/validation/live-agent-room-matrix-shadow-judge.json \
  --out-dir artifacts/evaluation/candidates

npm run eval -- \
  --input artifacts/evaluation/candidates/tight-room.json \
  --judge none

ollama serve
ollama pull qwen3-vl:8b-instruct-q4_K_M
npm run eval -- \
  --input artifacts/evaluation/candidates/tight-room.json \
  --judge ollama \
  --model qwen3-vl:8b-instruct-q4_K_M \
  --strict-judge \
  --out artifacts/evaluation/reports/tight-room.json
```

The harness never downloads a model itself. `--strict-judge` fails when Ollama is unavailable or
the model response is invalid. Without it, hard gates still run and the judge is honestly
`not_run`.

## Recorded observation — 13 August 2026

The evaluator source and final report set are frozen at release commit
[`7fe9009`](https://github.com/ming3465/MoveRealm/commit/7fe9009728d545798c1b5efd7b367d4f54264eaf).
Separately, [Pages run 31714506917](https://github.com/ming3465/MoveRealm/actions/runs/31714506917)
passed 100/100 tests across 13 files, the production build, and deployment for build
`build-31714506917`; the Ollama observations below were local evaluator runs, not CI jobs.

A fresh local CodeBuddy run produced materially different open, tight, and uncertain scenes and
complete 180-second plans. Each final report was regenerated in one evaluator invocation. Model
digest
`0533d74300e4f9bc367d675d4e64ffd073d50ff16a2b4096cc2e8a1cf8c96319` recorded:

| Case | Hard gates | Eligible | Advisory score | Adaptation | Judge latency |
|---|---|---|---:|---|---:|
| Open | passed | yes | 24 / 24 | not demonstrated | 93.790 s |
| Tight | passed | yes | 36 / 36 | demonstrated | 110.697 s |
| Uncertain, original CodeBuddy plan | **failed** | **no** | 19 / 24, advisory only | not demonstrated | 79.390 s |
| Uncertain, corrected fallback | passed | yes | 24 / 24 | not demonstrated | 73.674 s |

The final records are
[`open-room.json`](../artifacts/evaluation/reports/open-room.json),
[`tight-room.json`](../artifacts/evaluation/reports/tight-room.json),
[`uncertain-room-original.json`](../artifacts/evaluation/reports/uncertain-room-original.json), and
[`uncertain-room-corrected.json`](../artifacts/evaluation/reports/uncertain-room-corrected.json).

The uncertain plan included a squat despite an occluded floor. The Shadow Judge still liked it;
the production safety gate rejected it. A labelled deterministic fallback then produced reach-only
rounds and passed. This disagreement is more useful than the numeric score and demonstrates why
the model remains advisory. Production validation and fallback planning now enforce the invariant.
The recorded files under
[`artifacts/evaluation/`](../artifacts/evaluation/) contain synthetic fixture evidence only—no
participant media, webcam stream, landmarks, identity, or health inference.

## References

- [Qwen3-VL 8B Instruct GGUF model card and Apache-2.0 license](https://huggingface.co/Qwen/Qwen3-VL-8B-Instruct-GGUF)
- [Ollama Qwen3-VL 8B Q4 package](https://ollama.com/library/qwen3-vl%3A8b-instruct-q4_K_M)
- [Ollama vision structured-output documentation](https://docs.ollama.com/capabilities/structured-outputs)
