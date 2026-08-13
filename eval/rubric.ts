import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  validateAdaptationSafety,
  validatePlanSafety,
  validateSceneSafety,
} from "../src/shared/contracts.js";
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
      return "The plan request is anchored to the judged scene.";
    }),
    check("plan-safety", () => {
      validatePlanSafety(candidate.plan, candidate.planRequest);
      return "Plan passes the authoritative production duration, movement, and room-envelope gates.";
    }),
    ...candidate.adaptations.map((adaptation, index) =>
      check(`adaptation-${index + 1}-safety`, () => {
        validateAdaptationSafety(adaptation.decision, adaptation.request);
        const telemetry = adaptation.request.telemetry;
        const expectedRate = telemetry.targetsPresented
          ? telemetry.targetsCompleted / telemetry.targetsPresented
          : 0;
        assert(
          Math.abs(telemetry.completionRate - expectedRate) < 0.000001,
          "Telemetry completion rate contradicts target counts.",
        );
        return "Adaptation preserves the validated movement and its declared changes match telemetry.";
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
