import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runOllamaJudge, type JudgeResult } from "../eval/judge.js";
import { evaluateHardGates } from "../eval/rubric.js";
import {
  advisoryScore,
  EvalCandidateSchema,
  EvalReportSchema,
  FixtureManifestSchema,
  type EvalReport,
} from "../eval/schemas.js";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const inputPath = argument("--input");
if (!inputPath) throw new Error("Usage: npm run eval -- --input <candidate.json> [--judge none|ollama] [--out report.json]");
const judgeMode = argument("--judge") ?? "none";
if (judgeMode !== "none" && judgeMode !== "ollama") throw new Error("--judge must be none or ollama.");

const serializedInput = await readFile(resolve(inputPath), "utf8");
const candidate = EvalCandidateSchema.parse(JSON.parse(serializedInput));
const manifest = FixtureManifestSchema.parse(
  JSON.parse(await readFile(resolve("eval/fixtures.json"), "utf8")),
);
const oracle = manifest.fixtures.find((item) => item.id === candidate.fixtureId);
if (!oracle) throw new Error(`No fixture oracle exists for ${candidate.fixtureId}.`);
const deterministic = await evaluateHardGates(candidate, oracle);

let judge: JudgeResult = {
  status: "not_run",
  provider: "none",
  model: null,
  modelDigest: null,
  latencyMs: null,
  verdict: null,
  detail: "Advisory model judgment was not requested.",
  rawOmitted: true,
};
if (judgeMode === "ollama") {
  judge = await runOllamaJudge(candidate, oracle, {
    baseUrl: argument("--ollama-url") ?? "http://127.0.0.1:11434",
    model: argument("--model") ?? "qwen3-vl:8b-instruct-q4_K_M",
  });
}

const report: EvalReport = EvalReportSchema.parse({
  schemaVersion: "1.0.0",
  observedAt: new Date().toISOString(),
  inputSha256: createHash("sha256").update(serializedInput).digest("hex"),
  fixtureId: candidate.fixtureId,
  source: candidate.source,
  deterministic,
  judge,
  totals: {
    advisoryEarned: judge.verdict ? advisoryScore(judge.verdict).earned : null,
    advisoryPossible: judge.verdict ? advisoryScore(judge.verdict).possible : null,
    eligible: deterministic.passed,
  },
});

const serializedReport = `${JSON.stringify(report, null, 2)}\n`;
const outputPath = argument("--out");
if (outputPath) await writeFile(resolve(outputPath), serializedReport, "utf8");
process.stdout.write(serializedReport);
if (!deterministic.passed || (process.argv.includes("--strict-judge") && judge.status !== "scored")) {
  process.exitCode = 1;
}
