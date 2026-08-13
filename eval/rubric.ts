import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  validateAndGroundAdaptation,
  validatePlanSafety,
  validateSceneSafety,
} from "../src/shared/contracts.js";
import { createFallbackPlan } from "../src/shared/fallbacks.js";
import type { DeterministicCheck, EvalCandidate, FixtureOracle } from "./schemas.js";

function check(id: string, action: () => string): DeterministicCheck {
  try {
    return { id, status: "pass", detail: action() };
  } catch (error) {
    return {
      id,
      status: "fail",
      detail: error instanceof Error ? error.message.slice(0, 300) : "Validation failed.",
    };
  }
}

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

export async function evaluateHardGates(
  candidate: EvalCandidate,
  oracle: FixtureOracle,
): Promise<{ passed: boolean; checks: DeterministicCheck[] }> {
  const checks = [
    check("fixture-hash", () => "pending"),
    check("scene-schema-safety", () => {
      validateSceneSafety(candidate.scene);
      return "Scene satisfies the production schema and blocked-lane rule.";
    }),
    check("scene-oracle", () => {
      assert(
        oracle.expected.spaceClasses.includes(candidate.scene.spaceClass),
        `Expected ${oracle.expected.spaceClasses.join("/")} space, received ${candidate.scene.spaceClass}.`,
      );
      for (const direction of oracle.expected.requiredDirections) {
        assert(candidate.scene.permittedDirections.includes(direction), `Missing required ${direction} direction.`);
      }
      for (const direction of candidate.scene.permittedDirections) {
        assert(oracle.expected.allowedDirections.includes(direction), `Unexpected permitted ${direction} direction.`);
      }
      const zones = new Set(candidate.scene.obstacles.map((obstacle) => obstacle.zone));
      for (const zone of oracle.expected.requiredObstacleZones) {
        assert(zones.has(zone), `Missing a visible obstacle in the ${zone} zone.`);
      }
      for (const zone of zones) {
        assert(oracle.expected.allowedObstacleZones.includes(zone), `Unexpected obstacle zone ${zone}.`);
      }
      const [minimum, maximum] = oracle.expected.confidenceRange;
      assert(
        candidate.scene.confidence >= minimum && candidate.scene.confidence <= maximum,
        `Scene confidence ${candidate.scene.confidence} is outside ${minimum}-${maximum}.`,
      );
      return "Scene class, movement lanes, obstacle zones, and confidence match the fixture oracle.";
    }),
    check("request-consistency", () => {
      assert(
        JSON.stringify(candidate.planRequest.scene) === JSON.stringify(candidate.scene),
        "The plan request scene differs from the judged scene.",
      );
      const sceneDirections = new Set(candidate.scene.permittedDirections);
      const confirmedDirections = candidate.planRequest.constraints.permittedDirections;
      assert(
        new Set(confirmedDirections).size === confirmedDirections.length,
        "Confirmed movement directions must be unique.",
      );
      for (const direction of confirmedDirections) {
        assert(
          sceneDirections.has(direction),
          `Confirmed ${direction} movement exceeds the judged scene envelope.`,
        );
      }
      const hasConfirmedLateral = confirmedDirections.some(
        (direction) => direction === "left" || direction === "right",
      );
      assert(
        hasConfirmedLateral || candidate.planRequest.constraints.sideStepRange === "none",
        "A side-step range cannot be confirmed without a judged lateral lane.",
      );
      assert(
        candidate.scene.spaceClass === "open" || candidate.planRequest.constraints.sideStepRange !== "wide",
        "Only a judged open room can confirm a wide side-step range.",
      );
      return "The plan request and confirmed constraints stay inside the judged scene envelope.";
    }),
    check("plan-safety", () => {
      const runtimePlan = validatePlanSafety(candidate.plan, candidate.planRequest);
      assert(
        JSON.stringify(runtimePlan) === JSON.stringify(candidate.plan),
        "Plan movement instructions or safety copy are not the canonical runtime presentation.",
      );
      return "Plan passes the production gates and contains canonical movement instructions.";
    }),
    check("fallback-provenance", () => {
      if (candidate.source !== "fallback") {
        return "Candidate is not presented as the deterministic fallback.";
      }
      const expected = validatePlanSafety(
        createFallbackPlan(candidate.planRequest),
        candidate.planRequest,
      );
      assert(
        JSON.stringify(candidate.plan) === JSON.stringify(expected),
        "A fallback-labelled candidate must exactly match the production fallback plan.",
      );
      return "Fallback-labelled plan exactly matches the production fallback for this request.";
    }),
    ...candidate.adaptations.map((adaptation, index) =>
      check(`adaptation-${index + 1}-safety`, () => {
        assert(
          JSON.stringify(adaptation.request.constraints) ===
            JSON.stringify(candidate.planRequest.constraints),
          "Adaptation constraints differ from the validated plan request.",
        );
        assert(
          JSON.stringify(adaptation.request.intent) === JSON.stringify(candidate.planRequest.intent),
          "Adaptation intent differs from the validated plan request.",
        );
        const plannedRound = candidate.plan.rounds.find(
          (round) => round.id === adaptation.request.nextRoundSeed.id,
        );
        assert(plannedRound, "Adaptation seed is not a round in the validated plan.");
        assert(
          JSON.stringify(adaptation.request.nextRoundSeed) === JSON.stringify(plannedRound),
          "Adaptation seed differs from the validated plan round.",
        );
        const telemetryRound = candidate.plan.rounds.find(
          (round) => round.id === adaptation.request.telemetry.roundId,
        );
        assert(telemetryRound, "Adaptation telemetry is not attached to a validated plan round.");
        assert(
          telemetryRound.movementId === adaptation.request.telemetry.movementId,
          "Adaptation telemetry movement differs from the validated plan round.",
        );
        const telemetryRoundNumber = Number(adaptation.request.telemetry.roundId.slice("round-".length));
        const seedRoundNumber = Number(adaptation.request.nextRoundSeed.id.slice("round-".length));
        assert(
          seedRoundNumber === telemetryRoundNumber + 1,
          "Adaptation seed must be the round immediately after its telemetry.",
        );
        const runtimeDecision = validateAndGroundAdaptation(
          adaptation.decision,
          adaptation.request,
        );
        assert(
          JSON.stringify(runtimeDecision) === JSON.stringify(adaptation.decision),
          "Adaptation does not match the canonical runtime presentation and grounded trace.",
        );
        const telemetry = adaptation.request.telemetry;
        const expectedRate = telemetry.targetsPresented
          ? telemetry.targetsCompleted / telemetry.targetsPresented
          : 0;
        assert(
          Math.abs(telemetry.completionRate - expectedRate) < 0.000001,
          "Telemetry completion rate contradicts target counts.",
        );
        return "Adaptation preserves the validated movement, matches telemetry, and uses the grounded runtime trace.";
      }),
    ),
  ];

  checks[0] = await (async () => {
    try {
      const bytes = await readFile(resolve(oracle.image));
      const digest = createHash("sha256").update(bytes).digest("hex");
      assert(digest === oracle.sha256, "Fixture bytes do not match the independent oracle hash.");
      return { id: "fixture-hash", status: "pass", detail: "Fixture image hash matches the oracle." } as const;
    } catch (error) {
      return {
        id: "fixture-hash",
        status: "fail",
        detail: error instanceof Error ? error.message.slice(0, 300) : "Fixture hash validation failed.",
      } as const;
    }
  })();

  return { passed: checks.every((item) => item.status !== "fail"), checks };
}
