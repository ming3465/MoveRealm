# Portal submission — copy-paste sheet

Everything below is final text. Paste each block straight into the matching portal field.
[`SUBMISSION.md`](SUBMISSION.md) stays the working source of truth with the full evidence tables;
this file is only the fill-in-the-form version.

## You must supply three things

Everything else is done.

| Field | Action |
|---|---|
| Demo video URL | Upload `assets/submission/moverealm-guided-backup.mp4` + `.vtt` to YouTube or Google Drive, enable captions, test signed out |
| Team members | Add the real names/handles |
| Contact email | Use the **registered hackathon email** |

Verified 14 August 2026: the public URL returns HTTP 200, Pages run 31766511011 concluded
`success`, and the live site embeds commit `cf2ea8bc0cced379a7cf01bc968c5fe09a6b7e62` /
`build-31766511011`.

---

## Short fields

| Field | Paste this |
|---|---|
| Project title | `MoveRealm` |
| Direction / track | `Life Agent` |
| Product used | `CodeBuddy` |
| Short blurb (8 words, limit 10) | `Your room becomes a safe adaptive movement adventure.` |
| Public app URL | `https://ming3465.github.io/MoveRealm/` |
| Source / repository URL | `https://github.com/ming3465/MoveRealm` |
| Cover image (16:9, 380×216) | upload `assets/submission/moverealm-cover-380x216.png` |
| Demo video URL | ⬅ **you fill this in** |
| Team members | ⬅ **you fill this in** |
| Contact email | ⬅ **you fill this in** |

---

## Project description

Paste the whole block into the main description field.

```text
MoveRealm — turn any room into a safe, adaptive movement adventure.

OVERVIEW
MoveRealm is a three-minute, zero-equipment movement game for healthy adults who want a short,
approachable activity in the room they already have. The player approves one photo of their room,
confirms the clear floor and how far they can safely step sideways, and enters a single world:
Neon Rainforest. Reaches collect fireflies, squats shelter seedlings, and permitted side-steps
redirect a glowing river. Three 52-second rounds give 2.6 active minutes, and two 12-second rests
bring the complete adventure to 3.0 minutes. We report 2.6 active minutes rather than rounding it
up to three.

THE PROBLEM
Movement sessions often fail before they start, because time, safe space, and motivation are all
uncertain at once. Generic workout video cannot see the chair beside your movement lane, cannot
respect the floor space you actually confirmed, and cannot visibly adjust after a round that was
too hard. MoveRealm turns those constraints into the controller and keeps the session deliberately
short. This is our product hypothesis: the three planned user trials are still pending, so we do
not present it as completed user research.

THE AGENT
A CodeBuddy-powered Movement Director has three bounded jobs.
1. Read one user-approved room still and return obstacles, permitted movement directions, and a
   room class of open, tight, or uncertain.
2. Generate a three-round quest constrained by the confirmed floor and side-step envelope.
3. Take a round summary plus the player's explicit "too hard / just right / too easy" feedback and
   tune the parameters of the next, already-validated movement.

The agent parameterizes a validated game; it never invents one. Our Express adapter submits
structured scene, plan, and adaptation tasks to CodeBuddy's asynchronous /api/v1/runs endpoint and
reads the run's SSE stream. Zod schemas then treat every response as untrusted input.

WHY THIS IS SAFE
Deterministic TypeScript contracts, not the model, are the only automated safety authority.
- Only reach, squat, and side_step can ever execute. No jumping, no equipment, no invented exercise
  names, no diagnosis and no fatigue estimates.
- Three rounds plus configured rests must total exactly 180 seconds.
- Generated lateral range cannot exceed the envelope the user confirmed, and an uncertain room fails
  closed to in-place reaches only.
- Adaptation may tune range, tempo, and target rate, but can never replace the next movement.
- One schema-invalid response gets exactly one repair attempt. Anything still invalid selects a
  deterministic safe plan, and the UI visibly labels its source as CodeBuddy live, Safe fallback, or
  Guided demo. A fallback result is never narrated as a live agent result.

PRIVACY BY ARCHITECTURE
MediaPipe pose inference runs in a browser Worker. Live camera frames and pose landmarks never
leave the browser. Only the single room still the user approves is sent to scene analysis, and the
server deletes its temporary copy in a finally block. Sustained low pose confidence pauses the
world, and three reliable frames are required to resume. A completed session can export anonymous
aggregate evidence — counts, threshold states, director provenance, and exact build identity — with
no names, media, room text, or raw landmarks.

HOW WE VERIFIED IT
Release commit cf2ea8bc0cced379a7cf01bc968c5fe09a6b7e62, deployed as build-31766511011 by GitHub
Pages run 31766511011, passed 129 Vitest tests across 16 files, 13 Python recovery-agent tests, and
82 Python safety-probe tests, plus the strict production build and a dependency audit reporting 0
vulnerabilities.

Three independent evaluation layers test the safety claim instead of asserting it.
- An adversarial Safety Probe invents quests a careless or adversarial director might emit and asks
  the real production contracts to rule on them, comparing every verdict against an independently
  written restatement of the documented rules. Across 332 candidates: 302 refused, 30 compliant
  quests accepted, 0 breaches and 0 over-rejections. Twenty compliant control baselines were also
  accepted, so the refusals are provably selective rather than a gate that refuses everything.
  Binary search then measured seven movement-envelope limits, each matching its documented
  threshold.
- An offline Shadow Judge showed why deterministic safety must outrank model preference: it scored
  an unsafe uncertain-room plan positively, while the hard gate rejected that plan's occluded-floor
  squat and a reach-only fallback passed.
- A standard-library Python recovery agent runs observe, evaluate, recover, verify and is
  deliberately fail-closed: even when the small local model scored an unsafe candidate above the
  safe one, the agent selected only the fallback that production gates accepted.

All three are offline synthetic evaluations over fixed fixtures. None of them is a human trial, a
pose or latency measurement, or a safety certification.

IMPACT AND BUSINESS HYPOTHESIS
Our intended product outcomes are a first accepted movement within 45 seconds, at least 20 pose FPS
on an M1 Pro, and under 100 ms visible response latency. These are design targets, not measured
results: real-person FPS, visible response latency, time to first accepted movement, and all three
user trials are explicitly pending. A consent-first three-person protocol defines exactly how they
will be measured without retaining identifiers or room media.

The initial route is a consumer short-movement product. Licensing routes include corporate wellness,
hospitality, and community fitness, where the same bounded Movement Director can adapt branded
worlds to constrained rooms. These are commercial hypotheses; no revenue, conversion, retention, or
population-level user result has been validated.

SCOPE
This is light movement for healthy adults, not medical or rehabilitation guidance. Users should stop
if they feel pain, dizziness, or unwell.
```

---

## CodeBuddy product sharing

Paste into the "how you used the product" / product-feedback field.

```text
MoveRealm uses the CodeBuddy CLI HTTP service as its live Movement Director. Our Express adapter
submits structured scene, plan, and adaptation tasks to the asynchronous /api/v1/runs endpoint,
reads the SSE stream, validates every response against strict Zod safety contracts, retries one
schema-invalid response, and visibly switches to a deterministic safe fallback if the service is
unavailable. This made CodeBuddy useful as a bounded decision-maker inside a real-time product
rather than an opaque chatbot.

In practice, keeping one persistent "moverealm" HTTP session made scene, plan, and adaptation prompt
iteration fast. The most reliable pattern was strict JSON schemas, exactly one repair attempt, and
deterministic validation outside the model. Our recommended local route is fully free: CodeBuddy
Code orchestrating Apache-2.0 Qwen3-VL 4B through loopback Ollama, which produced three materially
different room profiles and safe 180-second plans with fallback forbidden.
```

---

## Required disclosures

Paste into the video description or any additional-notes field. Keep every line.

```text
Privacy: live camera frames and pose landmarks stay in the browser. One user-approved room still is
sent to scene analysis, and the server deletes its temporary copy after the request.

Safety boundary: only reach, squat, and side-step movements are permitted, never jumping. The user
must confirm the floor, and generated lateral range cannot exceed the confirmed envelope.

Tracking behaviour: sustained low pose confidence pauses the world; three reliable frames are
required to resume.

Adaptation boundary: the Movement Director may tune range, tempo, and target rate but cannot replace
the next validated movement.

Source disclosure: CodeBuddy live, Guided demo, and Safe fallback are different modes and stay
visibly labelled. A fallback result is never presented as a live agent result.

Evaluation disclosure: the Shadow Judge and Safety Probe are local, offline, synthetic, and
advisory. Neither is a runtime authority, nor safety, accuracy, official-judge, or human-trial
evidence.

Pending measurements: real-person pose FPS, visible response latency, time to first accepted
movement, and all three user trials are not yet measured and are stated as pending, not as results.

Health scope: this is light movement for healthy adults, not medical or rehabilitation guidance.
Users should stop if they feel pain, dizziness, or unwell.
```

---

## Supporting files to attach, if the portal has a field for them

| File | What it shows |
|---|---|
| `assets/submission/moverealm-cover-380x216.png` | required 16:9 cover |
| `assets/submission/moverealm-guided-backup.vtt` | captions, upload with the video |
| `assets/submission/moverealm-guided-backup-transcript.txt` | narration transcript |
| `assets/submission/screenshots/` | 6 consent-free guided UI PNGs + 2 controlled `CodeBuddy live` captures |
| `agent/evidence/safety-probe.md` | adversarial probe record |
| `artifacts/validation/codebuddy-local-qwen-matrix-5b77105.json` | three differentiated live rooms, fallback forbidden |

All checksums are frozen in [`../artifacts/submission-manifest.json`](../artifacts/submission-manifest.json).

---

## Do not change these while filling the form

- Do not turn the pending measurements into numbers. The 45 s / 20 FPS / 100 ms figures are targets.
- Do not describe the Safety Probe, Shadow Judge, recovery agent, fixtures, synthetic camera, or
  keyboard runs as a human trial or a real pose measurement.
- Do not describe a Safe fallback result as CodeBuddy live.
- Do not describe the local audit build ID `build-20260814` as a GitHub Actions run. The release
  build is `build-31766511011`.
- Keep the blurb under ten words.
