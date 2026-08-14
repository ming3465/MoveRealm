# MoveRealm safety probe

- Tool: `moverealm-safety-probe` 1.0.0, mode `contracts`
- Repository commit: `4df7cd03114a47e059bc5f03bdb98af3a8f21385`
- Repository HEAD tree: `f3e56cbe041b143837fbbbeb1d87c7d00d771ced`
- Repository worktree: **clean**; 0 status entries; status SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
- Observed: 2026-08-14T02:31:06Z to 2026-08-14T02:31:06Z

> Synthetic adversarial candidates evaluated against MoveRealm's production safety contracts. This is contract-behaviour evidence only: it is not a human trial, a pose or latency measurement, a security audit, a certification, or an assessment of CodeBuddy's output quality.

## Result

332 adversarial and control candidates were ruled on by `production-contracts` across 6 planning rounds (`no_new_probes`). The planner was `deterministic` (`active`).

| Outcome | Count |
|---|---:|
| Unsafe candidate refused (defended) | 302 |
| Compliant candidate accepted (honored) | 30 |
| **Breach — unsafe candidate accepted** | **0** |
| **Over-rejection — compliant candidate refused** | **0** |
| Inconclusive (gate unreachable) | 0 |

Controls: 20 compliant baselines, all accepted. Every compliant baseline was accepted, so the refusals below are selective.

## Measured envelope frontiers

| Boundary | Room | Accepted up to | Refused from | Documented | Agrees |
|---|---|---:|---:|---:|---|
| Narrow-room side-step envelope | tight | 0.6156 | 0.6203 | 0.62 | yes |
| Reach envelope without a vertical lane | no_vertical | 0.6156 | 0.6203 | 0.62 | yes |
| Reach envelope without a lateral lane | no_lateral | 0.7 | 0.7047 | 0.7 | yes |
| Uncertain-room envelope | uncertain | 0.6156 | 0.6203 | 0.62 | yes |
| Schema range-scale ceiling in a fully open room | open | 1.0 | 1.0031 | 1.0 | yes |
| Target-rate ceiling | open | 16 | 17 | 16 | yes |
| Adapted envelope lock without a lateral lane | uncertain | 0.6156 | 0.6203 | 0.62 | yes |

## Invariant coverage

| Invariant | Tier | Probes | Defended | Breaches |
|---|---|---:|---:|---:|
| `adapt.adjustment_labels` | specified | 5 | 5 | 0 |
| `adapt.conservative_envelope_lock` | specified | 1 | 1 | 0 |
| `adapt.declared_matches_actual` | documented | 15 | 15 | 0 |
| `adapt.none_exclusive` | specified | 5 | 5 | 0 |
| `adapt.preserve_movement` | documented | 20 | 20 | 0 |
| `adapt.reason` | specified | 5 | 5 | 0 |
| `adapt.round_bounds` | specified | 5 | 5 | 0 |
| `adapt.shape` | specified | 15 | 15 | 0 |
| `adapt.side_step_narrow_envelope` | documented | 1 | 1 | 0 |
| `adapt.too_hard_must_reduce` | specified | 5 | 5 | 0 |
| `adapt.too_hard_no_increase` | documented | 10 | 10 | 0 |
| `combination.envelope_behind_decoy` | n/a | 18 | 13 | 0 |
| `combination.lateral_and_budget` | n/a | 2 | 2 | 0 |
| `combination.rebuilt_final_round` | n/a | 18 | 13 | 0 |
| `control.adaptation` | n/a | 10 | 0 | 0 |
| `control.plan` | n/a | 5 | 0 | 0 |
| `control.scene` | n/a | 5 | 0 | 0 |
| `plan.copy_bounds` | specified | 5 | 5 | 0 |
| `plan.duration_total` | documented | 15 | 15 | 0 |
| `plan.floor_confirmed` | documented | 5 | 5 | 0 |
| `plan.mechanic_pairing` | documented | 11 | 11 | 0 |
| `plan.movement_vocabulary` | documented | 12 | 12 | 0 |
| `plan.reach_envelope_without_lateral` | specified | 2 | 2 | 0 |
| `plan.reach_envelope_without_vertical` | specified | 1 | 1 | 0 |
| `plan.round_bounds` | specified | 30 | 30 | 0 |
| `plan.round_copy` | specified | 5 | 5 | 0 |
| `plan.round_count` | documented | 10 | 10 | 0 |
| `plan.round_ids` | derived | 5 | 5 | 0 |
| `plan.shape` | specified | 20 | 20 | 0 |
| `plan.side_step_narrow_envelope` | documented | 2 | 2 | 0 |
| `plan.side_step_requires_lateral` | documented | 2 | 2 | 0 |
| `plan.squat_requires_vertical` | specified | 1 | 1 | 0 |
| `plan.theme` | specified | 5 | 5 | 0 |
| `plan.uncertain_conservative_envelope` | documented | 5 | 5 | 0 |
| `plan.uncertain_reach_only` | documented | 1 | 1 | 0 |
| `scene.confidence` | specified | 5 | 5 | 0 |
| `scene.directions` | specified | 15 | 15 | 0 |
| `scene.high_severity_blocks_lane` | documented | 5 | 5 | 0 |
| `scene.obstacles` | specified | 10 | 10 | 0 |
| `scene.shape` | specified | 10 | 10 | 0 |
| `scene.summary` | specified | 5 | 5 | 0 |

## Findings

None. No documented rule was breached and no compliant candidate was refused.

## Scope and privacy

- Synthetic adversarial candidates evaluated against MoveRealm's production safety contracts. This is contract-behaviour evidence only: it is not a human trial, a pose or latency measurement, a security audit, a certification, or an assessment of CodeBuddy's output quality.
- No participant data, camera frame, pose landmark, room still, identity, or health inference is read or written. Every room in this report is a synthetic fixture defined in the tool itself.
