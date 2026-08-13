import { z } from "zod";
import {
  AdaptRequestSchema,
  AdaptationDecisionSchema,
  DirectionSchema,
  PlanRequestSchema,
  QuestPlanSchema,
  SceneProfileSchema,
} from "../src/shared/contracts.js";

export const FixtureOracleSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    image: z.string().regex(/^assets\/room-fixtures\/[a-z0-9-]+\.png$/),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    expected: z
      .object({
        spaceClasses: z.array(z.enum(["tight", "open", "uncertain"])).min(1),
        requiredDirections: z.array(DirectionSchema),
        allowedDirections: z.array(DirectionSchema).min(1),
        requiredObstacleZones: z.array(z.enum(["left", "center", "right", "floor"])),
        allowedObstacleZones: z.array(z.enum(["left", "center", "right", "floor"])).min(1),
        confidenceRange: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]),
      })
      .strict(),
  })
  .strict();

export type FixtureOracle = z.infer<typeof FixtureOracleSchema>;

export const FixtureManifestSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    fixtures: z.array(FixtureOracleSchema).length(3),
  })
  .strict();

export const EvalCandidateSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    fixtureId: z.string().regex(/^[a-z0-9-]+$/),
    source: z.enum(["codebuddy", "fallback", "demo"]),
    candidateDetail: z.string().trim().min(1).max(240).optional(),
    scene: SceneProfileSchema,
    planRequest: PlanRequestSchema,
    plan: QuestPlanSchema,
    adaptations: z
      .array(
        z
          .object({
            request: AdaptRequestSchema,
            decision: AdaptationDecisionSchema,
          })
          .strict(),
      )
      .max(3),
  })
  .strict();

export type EvalCandidate = z.infer<typeof EvalCandidateSchema>;

const ScoreSchema = z.number().int().min(0).max(4);
const CriterionSchema = z
  .object({
    score: ScoreSchema,
    rationale: z.string().trim().min(1).max(280),
    evidence: z.array(z.string().trim().min(1).max(160)).min(1).max(4),
    concerns: z.array(z.string().trim().min(1).max(160)).max(4),
  })
  .strict();

export const JudgeVerdictSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    scene: z
      .object({
        grounding: CriterionSchema,
        conservatism: CriterionSchema,
        actionability: CriterionSchema,
      })
      .strict(),
    plan: z
      .object({
        roomRelevance: CriterionSchema,
        movementVariety: CriterionSchema,
        themeCopy: CriterionSchema,
      })
      .strict(),
    adaptation: z
      .object({
        status: z.enum(["demonstrated", "not_demonstrated"]),
        telemetryGrounding: CriterionSchema.nullable(),
        proportionality: CriterionSchema.nullable(),
        explanationQuality: CriterionSchema.nullable(),
      })
      .strict()
      .superRefine((adaptation, context) => {
        const criteria = [
          adaptation.telemetryGrounding,
          adaptation.proportionality,
          adaptation.explanationQuality,
        ];
        if (adaptation.status === "demonstrated" && criteria.some((criterion) => criterion === null)) {
          context.addIssue({ code: "custom", message: "Demonstrated adaptations require all criteria." });
        }
        if (adaptation.status === "not_demonstrated" && criteria.some((criterion) => criterion !== null)) {
          context.addIssue({ code: "custom", message: "Missing adaptations must not receive scores." });
        }
      }),
    unsupportedClaims: z.array(z.string().trim().min(1).max(180)).max(8),
    overallNotes: z.string().trim().min(1).max(360),
  })
  .strict();

export type JudgeVerdict = z.infer<typeof JudgeVerdictSchema>;

export const DeterministicCheckSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    status: z.enum(["pass", "fail", "not_applicable"]),
    detail: z.string().trim().min(1).max(300),
  })
  .strict();

export type DeterministicCheck = z.infer<typeof DeterministicCheckSchema>;

export const EvalReportSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    observedAt: z.string().datetime(),
    inputSha256: z.string().regex(/^[a-f0-9]{64}$/),
    fixtureId: z.string(),
    source: z.enum(["codebuddy", "fallback", "demo"]),
    deterministic: z
      .object({ passed: z.boolean(), checks: z.array(DeterministicCheckSchema).min(1) })
      .strict(),
    judge: z
      .object({
        status: z.enum(["scored", "not_run", "invalid"]),
        provider: z.enum(["none", "ollama"]),
        model: z.string().nullable(),
        modelDigest: z.string().nullable(),
        latencyMs: z.number().int().min(0).nullable(),
        verdict: JudgeVerdictSchema.nullable(),
        detail: z.string().trim().min(1).max(300),
        rawOmitted: z.literal(true),
      })
      .strict(),
    totals: z
      .object({
        advisoryEarned: z.number().int().min(0).max(36).nullable(),
        advisoryPossible: z.union([z.literal(24), z.literal(36)]).nullable(),
        eligible: z.boolean(),
      })
      .strict(),
  })
  .strict();

export type EvalReport = z.infer<typeof EvalReportSchema>;

export function advisoryScore(verdict: JudgeVerdict): { earned: number; possible: 24 | 36 } {
  const criteria = [
    ...Object.values(verdict.scene),
    ...Object.values(verdict.plan),
    ...(verdict.adaptation.status === "demonstrated"
      ? [
          verdict.adaptation.telemetryGrounding!,
          verdict.adaptation.proportionality!,
          verdict.adaptation.explanationQuality!,
        ]
      : []),
  ];
  return {
    earned: criteria.reduce((sum, criterion) => sum + criterion.score, 0),
    possible: verdict.adaptation.status === "demonstrated" ? 36 : 24,
  };
}

export function judgeVerdictJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(JudgeVerdictSchema) as Record<string, unknown>;
}
