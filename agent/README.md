# MoveRealm Safety Probe

An adversarial Python agent that red-teams MoveRealm's Movement Director safety contracts.

MoveRealm's central claim is that deterministic contracts — not the model — are the sole runtime
safety authority. The Shadow Judge scores *quality* after the fact. Nothing was attacking the gate
itself. This agent does: it invents quests a careless or adversarial director might emit, asks the
**real** production gates to rule on them, and reports every disagreement with the documented rules.

It never approves, rewrites, blocks, or executes a quest, and it touches no participant data.

## Run it

```bash
python3 agent/run_probe.py                    # attack the production contracts
python3 agent/run_probe.py --mode live        # audit a running adapter (npm run dev first)
python3 agent/run_probe.py --mode both --out-dir agent/evidence
npm run probe                                 # same as the first line
```

Python 3.10+ and the standard library only. Contracts mode also needs `npm install`, because it
drives the real Zod gates through `tsx`.

Exit codes: `0` clean, `1` findings or live-check failures, `2` the gate was unreachable.

```bash
npm run probe:tests                           # 82 tests, standard library only
```

## How it works

```text
                 ┌──────────────────────┐
   fixtures ────►│  planner              │  catalogue → escalation → combination
                 │  (+ optional Ollama)  │
                 └──────────┬───────────┘
                            │ candidate
              ┌─────────────┴─────────────┐
              ▼                           ▼
   ┌────────────────────┐      ┌─────────────────────────┐
   │ documented-rule    │      │ contract_bridge.ts      │
   │ oracle (Python)    │      │ → validatePlanSafety()  │  the shipped gate
   │ "should refuse?"   │      │ → Zod schemas           │
   └─────────┬──────────┘      └───────────┬─────────────┘
             └────────────► compare ◄──────┘
                              │
     defended · honored · breach · over-rejection · inconclusive
```

Five outcomes, and only two of them are findings:

| Outcome | Oracle | Gate | Meaning |
|---|---|---|---|
| `defended` | refuse | refuse | The gate caught the attack. |
| `honored` | allow | allow | A compliant quest still gets planned. |
| **`breach`** | refuse | allow | Something the documented rules forbid got through. |
| **`over_rejection`** | allow | refuse | A legitimate quest was refused. |
| `inconclusive` | — | unreachable | Never counted as a pass. |

### Why an independent oracle

`oracle.py` is written from the README's "What is enforced", `docs/EVALUATION.md`, and the wire
contract — deliberately **not** translated from `src/shared/contracts.ts`. If it were a translation,
it could only ever agree with itself. Because it is independent, a disagreement is real information:
the documentation, the oracle, or the gate has drifted from the other two. Every rule carries a
citation and a tier (`documented`, `specified`, `derived`) so a reader can check the claim.

### Why controls matter

A gate that refuses *everything* would score a perfect zero breaches. So each run first submits 20
compliant baselines — one scene, one quest, and two adaptations per room. If any of them is refused,
the report says so and the refusals below it cannot be read as selective.

### Why the loop is a loop

Round 0 fires the whole catalogue. Every round after that is built from what was just observed:

- a defended attack gets **retried halfway back toward the compliant value** — a gate that blocks
  `0.95` but not `0.63` has a different boundary than the docs claim;
- the same violation is **moved into the final round**, because a gate that only checks round one is
  a bug;
- an accepted candidate gets an **undeclared field attached**, to confirm strictness survives.

The run stops when consecutive rounds produce nothing new, not after a fixed count.

### Measured frontiers

Catalogue probes prove a rule fires. The measurement phase bisects *where* it fires, which is
something you cannot read off the source without running it:

| Boundary | Documented | Observed (frozen contracts run `cf15709`) |
|---|---:|---|
| Narrow-room side-step envelope | 0.62 | accepted ≤ 0.6156, refused ≥ 0.6203 |
| Reach without a vertical lane | 0.62 | accepted ≤ 0.6156, refused ≥ 0.6203 |
| Reach without a lateral lane | 0.70 | accepted ≤ 0.7, refused ≥ 0.7047 |
| Uncertain-room envelope | 0.62 | accepted ≤ 0.6156, refused ≥ 0.6203 |
| Range-scale ceiling | 1.0 | accepted ≤ 1.0, refused ≥ 1.0031 |
| Target-rate ceiling | 16 | accepted ≤ 16, refused ≥ 17 |
| Adapted envelope lock | 0.62 | accepted ≤ 0.6156, refused ≥ 0.6203 |

### Optional local model planner

`--planner ollama` asks a local model for additional single-field mutations, using the same
provider, temperature, seed, and `keep_alive` conventions as the project's Shadow Judge. The model
can only ever *suggest* a patch: the oracle still rules and the production gate still decides. If
Ollama is absent or the model is not installed, the run continues and the report records
`planner.status: "not_run"` — it never downloads a model and never silently downgrades.

Model-proposed paths are address-repaired before use (a leading `plan` wrapper is dropped and string
round indices are coerced), because small models reliably get the shape right and the spelling
wrong. Repairing the *address* is safe; the proposed *value* still has to survive both the oracle and
the production gate. Model-planner observations are development diagnostics unless their own
privacy-reviewed report is preserved. The model contributes to early rounds only, since each call
costs a full model load.

## Live mode

The HTTP API accepts a *request* and returns a plan; it never accepts a caller-supplied plan. So
live mode asks two different questions:

1. does the adapter refuse unconfirmed floors, opted-out jumping, over-long sessions, undeclared
   request fields, invented directions, and impossible telemetry counts, and
2. does every plan and adaptation it actually returns satisfy the documented rules — audited by the
   same independent oracle, without trusting the server's own validation?

Question 2 covers the deterministic fallback today and live CodeBuddy output when it is connected.

## Frozen contracts-only observation — 14 August 2026

Against clean commit `cf157093ff3dab7b3598387d68973f82a3e364c2`, tree
`404fdc889cabc0212a6fd2197102eff7da5abde6`:

- **Contracts mode:** 332 candidates over 6 rounds, terminated `no_new_probes`. 302 defended,
  30 honored, **0 breaches, 0 over-rejections, 0 inconclusive**. All 20 controls accepted. All seven
  measured frontiers agreed with the documented thresholds.
The contracts-only record is [`evidence/safety-probe.json`](evidence/safety-probe.json) and
[`evidence/safety-probe.md`](evidence/safety-probe.md).
No live-mode result is stored in those files; run `--mode live` against the intended adapter and
preserve a separate report before citing a live probe count.

This is contract-behaviour evidence over synthetic rooms. It is **not** a human trial, a pose or
latency measurement, a security audit, a certification, or an assessment of CodeBuddy's output
quality. A clean report means the documented rules and the shipped gate agreed on 332 candidates —
not that no unsafe quest exists.

## Layout

| Path | Role |
|---|---|
| `bridge/contract_bridge.ts` | JSON-lines stdio service exposing the real Zod gates |
| `moverealm_probe/oracle.py` | independent restatement of the documented rules |
| `moverealm_probe/fixtures.py` | five synthetic rooms and their compliant baselines |
| `moverealm_probe/catalogue.py` | the adversarial repertoire |
| `moverealm_probe/planner.py` | catalogue, reactive escalation, optional Ollama proposals |
| `moverealm_probe/agent.py` | the perceive → rule → act → compare → adapt loop |
| `moverealm_probe/boundary.py` | frontier bisection |
| `moverealm_probe/live.py` | running-adapter audit |
| `moverealm_probe/report.py` | privacy-safe JSON and Markdown evidence |
| `tests/` | 82 tests, including stub gates that prove a breach *would* be reported |
