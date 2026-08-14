# MoveRealm CodeBuddy handoff

This project uses CodeBuddy as the runtime **Movement Director**, not as an unbounded chatbot or a
safety authority. Read [`AGENT.md`](AGENT.md) first for the full repository/release handoff.

## Runtime responsibility

CodeBuddy has three bounded jobs:

1. Analyze one explicit room still into a conservative `SceneProfile`.
2. Produce a three-round `QuestPlan` from confirmed scene constraints and user intent.
3. Adapt the already-selected next round from measured telemetry and explicit feedback.

The model may only parameterize validated `reach`, `squat`, and `side_step` mechanics. TypeScript
contracts remain authoritative. CodeBuddy cannot invent exercises, change the visual world,
diagnose form, estimate fatigue, infer health state, or override a deterministic rejection.

## Recommended free local model

- Orchestrator: CodeBuddy Code 2.136.0
- Provider: loopback Ollama 0.23.1
- Base model: `qwen3-vl:4b-instruct-q4_K_M` (Apache-2.0, approximately 3.3 GB)
- Runtime alias: `moverealm-director:4b`
- Recorded alias manifest SHA-256:
  `5e041b6a9a2057628a7e5ba3de78e130ef3e7800163d85bcc0db3385d186fc75`
- Recorded base manifest SHA-256:
  `ee4b975b58c17ce268cd19d40db35d5edc64603035d2ffc1fee1968eb0947f7b`

The project never auto-downloads model weights. Pull/create the model only when the user explicitly
wants the local model installed on that device.

## Start the local director

Use separate terminals:

```bash
ollama serve
```

```bash
ollama pull qwen3-vl:4b-instruct-q4_K_M
npm run director:local:setup
npm run codebuddy:local
```

```bash
npm run dev
# app/adapter: http://127.0.0.1:4173
# CodeBuddy:   http://127.0.0.1:8080
```

`npm run codebuddy:local` binds CodeBuddy to loopback, disables session persistence/auto-memory,
allows only the `Read` tool, caps runs at two turns, and tells the model to return exactly one JSON
object. The model may call `Read` only for the attachment path explicitly listed in the scene prompt.
It must never read any other file or call a tool for plan/adaptation requests.

If using authenticated CodeBuddy instead, copy `.env.example` to an untracked `.env` and set
`CODEBUDDY_PASSWORD` there. Never put it in Vite variables, the browser, logs, evidence, or commits.

## HTTP/application boundary

- `POST /api/scene/analyze` — multipart room still → `SceneProfile`
- `POST /api/quest/plan` — confirmed scene + constraints + intent → `QuestPlan`
- `POST /api/quest/adapt` — telemetry + next-round seed + constraints + intent →
  `AdaptationDecision`
- `GET /api/health` — reports whether CodeBuddy is connected or fallback mode is active

Relevant implementation:

- `server/app.ts` — routes, repair/fallback choice, upload lifecycle
- `server/codebuddy.ts` — async run submission, SSE/status, shared timeout signal
- `server/prompts.ts` — structured role/task prompts
- `src/shared/contracts.ts` — Zod schemas and deterministic safety validation
- `src/shared/fallbacks.ts` — deterministic safe scene/plan/adaptation
- `src/lib/directorApi.ts` — browser request deadlines and source metadata
- `src/components/DirectorBadge.tsx` — visible `CodeBuddy live`, `Safe fallback`, or `Guided demo`

## Hard output rules

Scene output must include:

- `spaceClass`: `tight`, `open`, or `uncertain`
- visible obstacles with zones/severity
- a non-empty conservative `permittedDirections`
- bounded confidence and a short scene summary

Direction semantics matter:

- `vertical` means a standing up/down central-body lane; it does not mean jumping.
- A clearly usable central standing lane should normally include `vertical` and `center`.
- An open fixture should expose `vertical`, `left`, `right`, and `center`.
- An uncertain/occluded view may conservatively return `center` only. Do not force the model to
  claim an unseen vertical or lateral lane.

Plan output must:

- use theme `neon_rainforest`;
- contain exactly three known movement rounds;
- include two configured rests and total exactly 180 seconds;
- use canonical movement/mechanic/prompt/accent combinations;
- honor confirmed directions, no-jumping, uncertain reach-only behavior, and side-step caps.

Adaptation output must:

- preserve round identity, movement, duration, mechanic, canonical prompt, and accent;
- remain inside room/intent limits;
- make a display-visible parameter change when change is required;
- derive its user-facing reason from telemetry and the actual validated diff;
- never narrate fatigue, form, diagnosis, injury, calories, or unsupported state.

Every model output is parsed and safety-validated. A malformed response gets exactly one repair
attempt. A second failure returns a validated deterministic result with a visible `Safe fallback`
badge. Fallback is a successful resilience path, not proof that the model understood the input.

## Verify the live local loop

With Ollama, CodeBuddy, and the app running:

```bash
MOVEREALM_URL=http://127.0.0.1:4173 \
MOVEREALM_ROOM_MATRIX=1 \
MOVEREALM_AGENT_EVIDENCE=/tmp/moverealm-room-matrix.json \
npm run smoke:agent
```

Fallback is forbidden by default. Set `MOVEREALM_ALLOW_FALLBACK=1` only when intentionally testing
recovery. The smoke uses synthetic room fixtures and keyboard telemetry; it is not a human trial.

Build independent evaluator candidates and run the authoritative non-model gates:

```bash
npm run eval:candidates -- \
  --input /tmp/moverealm-room-matrix.json \
  --out-dir /tmp/moverealm-eval-candidates

npm run eval -- \
  --input /tmp/moverealm-eval-candidates/tight-room.json \
  --judge none
```

Optional advisory Shadow Judge:

```bash
npm run eval -- \
  --input /tmp/moverealm-eval-candidates/tight-room.json \
  --judge ollama \
  --model qwen3-vl:4b-instruct-q4_K_M \
  --strict-judge
```

The judge score cannot make an unsafe candidate eligible. Keep deterministic failures and model
scores separate.

The dependency-free Python recovery agent is separate from the runtime director:

```bash
npm run test:python
npm run agent:python -- \
  --candidate artifacts/evaluation/candidates/uncertain-room-original.json \
  --fallback-candidate artifacts/evaluation/candidates/uncertain-room.json \
  --judge none
```

It implements `observe → evaluate → recover → verify`, only accepts a fallback sharing the exact
candidate context, and never becomes a second runtime safety authority.

## Audit live director output with the Safety Probe

The evaluator above judges frozen candidates. The Safety Probe in [`agent/`](agent/README.md) asks a
different question of a **running** director: does every plan and adaptation it actually returns
satisfy the documented rules, checked by an independent Python oracle that does not trust the
server's own validation?

With Ollama, CodeBuddy, and the app running:

```bash
npm run probe -- --mode live --base-url http://127.0.0.1:4173
```

It walks five synthetic rooms and, for each, audits the returned plan (documented rules, the exact
180-second budget, visible director provenance) and the returned `too_hard` adaptation (documented
rules, and that the round visibly gets easier). It then sends six adversarial requests the adapter
must refuse before any director is consulted: unconfirmed floor, opted-out jumping, an over-long
session, an undeclared request field, an invented direction, and impossible telemetry counts.

Read the results carefully:

- Every check records `directorSource`. A run in which those read `fallback` is **fallback evidence,
  not CodeBuddy evidence** — expected whenever a call exceeds the 45-second cap or returns invalid
  output. Check the source column before describing a live probe result as a model observation.
- Live mode issues about ten director calls, so at observed 20–48 s latencies budget several minutes.
- A `Returned plan satisfies the documented rules` failure means the director produced something the
  documentation forbids *and* the server let it through. Treat it as a contract gap, not a probe bug.

**Nothing is preserved for this path yet.** The stored record in `agent/evidence/` is contracts-only
and carries no `live` block. Running live mode against a connected CodeBuddy director and preserving
a separate privacy-reviewed report is the open follow-up; the report already omits image bytes, raw
model output, credentials, attachment paths, and identity.

The probe never approves, rewrites, blocks, or executes a quest, and it is not a second runtime
safety authority.

## Last verified local-model observation

Record:
[`artifacts/validation/codebuddy-local-qwen-matrix-5b77105.json`](artifacts/validation/codebuddy-local-qwen-matrix-5b77105.json)

- Clean application checkpoint: `5b77105ac4813df7f2f270ccb07f054550533008`
- Open: all four directions; reach/squat/side-step at range 1.0; 180 seconds
- Tight: vertical + center; reach 0.70, squat 0.62, reach 0.70; 180 seconds
- Uncertain: center only; reach 0.48/0.52/0.56; 180 seconds
- `too_hard` adaptation: squat range 0.62→0.46, tempo 1.00→0.87, target rate 10→9
- Observed scene latency: 24.264 s, 25.974 s, 47.784 s
- Observed plan latency: 20.375 s, 21.150 s, 20.864 s
- Observed adaptation latency: 6.867 s
- All three current deterministic evaluator cases: passed/eligible
- Temporary upload directory afterward: empty

These are controlled synthetic fixture/model measurements. They are not real-person tracking FPS,
visible response latency, TTFF, completion, safety certification, or user-trial results.

## Known diagnostic distinction

Chrome's built-in fake camera displays a green test card with a bright green circle. It is not a
room. In the last captured-camera diagnostic, Qwen returned an empty `permittedDirections` array
twice. The schema rejected both and the app visibly switched to its deterministic fallback. Preserve
that behavior; do not weaken the schema merely to make the fake-camera smoke look live.

If realistic fixture calls pass while this green test card falls back, the model loop is working as
designed. Use the strict fixture matrix for room-quality evidence and the fake-camera run for
fallback resilience evidence.

Signed-in/upstream CodeBuddy previously produced 429 and timeout observations. The recommended
deadline route is the local 4B model. One structured attempt is capped at 45 seconds; browser API and
smoke deadlines allow the single repair attempt. Do not silently raise these into unbounded waits.

## Privacy and cleanup

- Live camera frames and pose landmarks never go to CodeBuddy.
- Only the user-captured still is attached to scene analysis.
- The adapter deletes the temporary file after success, repair, timeout, validation failure, or
  fallback.
- Evidence must omit image bytes, raw model output, credentials, local attachment paths, and user
  identity.
- Confirm cleanup with `npm run trial:check-uploads` or by inspecting the documented temp directory
  only after following the trial protocol.

## Do not claim yet

The following remain pending until three consenting real-webcam trials are performed:

- M1 Pro tracking FPS p05 ≥20 with the required samples
- real capture-to-visible response p95 <100 ms with the required samples
- real time to first accepted movement
- real target completion and movement coverage
- live pose-loss pause/resume observation
- three-user usability observations

Use [`docs/TRIAL_PROTOCOL.md`](docs/TRIAL_PROTOCOL.md) and preserve only anonymous exported evidence.
