import { randomUUID } from "node:crypto";
import { mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express, { type Express, type Request, type Response } from "express";
import multer from "multer";
import {
  AdaptRequestSchema,
  PlanRequestSchema,
  validateSceneSafety,
  validateAndGroundAdaptation,
  validatePlanSafety,
  type DirectorMeta,
} from "../src/shared/contracts.js";
import {
  createFallbackAdaptation,
  createFallbackPlan,
  createFallbackSceneProfile,
} from "../src/shared/fallbacks.js";
import {
  CodeBuddyClient,
  CodeBuddyError,
  DEFAULT_CODEBUDDY_RUN_TIMEOUT_MS,
  MAX_CODEBUDDY_RUN_TIMEOUT_MS,
} from "./codebuddy.js";
import { adaptationPrompt, planPrompt, repairPrompt, scenePrompt } from "./prompts.js";

interface AppOptions {
  codeBuddy?: Pick<CodeBuddyClient, "isHealthy" | "runStructured">;
  forceFallback?: boolean;
  now?: () => number;
  uploadDirectory?: string;
  orphanMaxAgeMs?: number;
  removeFile?: (path: string) => Promise<void>;
  warn?: (message: string) => void;
}

const defaultUploadDirectory = join(tmpdir(), "moverealm-room-stills");
const DEFAULT_ORPHAN_MAX_AGE_MS = 10 * 60_000;
const ROOM_STILL_NAME = /^room-[0-9a-f-]+\.(?:jpe?g|png|webp)$/i;
const CLEANUP_WARNING =
  "[MoveRealm] A temporary room still could not be deleted; startup cleanup will retry it.";
const STARTUP_CLEANUP_WARNING =
  "[MoveRealm] An orphaned temporary room still could not be removed during startup cleanup.";
const IMAGE_EXTENSION: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

function cleanupOrphanedRoomStills(
  directory: string,
  maxAgeMs: number,
  warn: (message: string) => void,
): void {
  const normalizedMaxAgeMs = Math.max(0, maxAgeMs);
  const cutoff = Date.now() - normalizedMaxAgeMs;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile() || !ROOM_STILL_NAME.test(entry.name)) continue;
    const path = join(directory, entry.name);
    try {
      if (normalizedMaxAgeMs > 0 && statSync(path).mtimeMs > cutoff) continue;
      unlinkSync(path);
    } catch {
      // Never log the local path or upstream error; either could contain sensitive data.
      warn(STARTUP_CLEANUP_WARNING);
    }
  }
}

function createUpload(directory: string) {
  return multer({
    storage: multer.diskStorage({
      destination: directory,
      filename: (_request, file, callback) => {
        const extension = IMAGE_EXTENSION[file.mimetype] ?? ".jpg";
        callback(null, `room-${randomUUID()}${extension}`);
      },
    }),
    limits: { files: 1, fileSize: 8 * 1024 * 1024 },
    fileFilter: (_request, file, callback) => {
      callback(null, file.mimetype in IMAGE_EXTENSION);
    },
  });
}

function cleanError(error: unknown): string {
  if (!(error instanceof Error)) return "Movement Director unavailable.";
  return error.message.replace(/Bearer\s+\S+/gi, "Bearer [redacted]").slice(0, 200);
}

function meta(
  source: DirectorMeta["source"],
  startedAt: number,
  now: () => number,
  detail?: string,
): DirectorMeta {
  return {
    source,
    latencyMs: Math.max(0, Math.round(now() - startedAt)),
    label: source === "codebuddy" ? "Live CodeBuddy" : "Deterministic fallback",
    ...(detail ? { detail } : {}),
  };
}

async function runWithRepair<T>(
  codeBuddy: Pick<CodeBuddyClient, "runStructured">,
  prompt: string,
  validate: (value: unknown) => T,
  attachments: Parameters<CodeBuddyClient["runStructured"]>[2] = [],
): Promise<T> {
  try {
    return validate(await codeBuddy.runStructured(prompt, validate, attachments));
  } catch (error) {
    if (!(error instanceof CodeBuddyError) || !error.message.includes("failed validation")) throw error;
    return validate(
      await codeBuddy.runStructured(repairPrompt(prompt, error.message), validate, attachments),
    );
  }
}

function fallbackPlan(request: Parameters<typeof createFallbackPlan>[0]) {
  return validatePlanSafety(createFallbackPlan(request), request);
}

function fallbackAdaptation(request: Parameters<typeof createFallbackAdaptation>[0]) {
  return validateAndGroundAdaptation(createFallbackAdaptation(request), request);
}

export function resolveCodeBuddyTimeoutMs(configuredValue: string | undefined): number {
  const configured = Number(configuredValue);
  if (!Number.isFinite(configured) || configured <= 0) {
    return DEFAULT_CODEBUDDY_RUN_TIMEOUT_MS;
  }
  return Math.min(configured, MAX_CODEBUDDY_RUN_TIMEOUT_MS);
}

export function createApp(options: AppOptions = {}): Express {
  const app = express();
  const now = options.now ?? performance.now.bind(performance);
  const warn = options.warn ?? console.warn;
  const uploadDirectory = options.uploadDirectory ?? defaultUploadDirectory;
  const removeFile = options.removeFile ?? unlink;
  mkdirSync(uploadDirectory, { recursive: true });
  cleanupOrphanedRoomStills(
    uploadDirectory,
    options.orphanMaxAgeMs ?? DEFAULT_ORPHAN_MAX_AGE_MS,
    warn,
  );
  const upload = createUpload(uploadDirectory);
  const forceFallback =
    options.forceFallback ?? process.env.MOVEREALM_FORCE_FALLBACK === "1";
  const codeBuddyTimeoutMs = resolveCodeBuddyTimeoutMs(process.env.CODEBUDDY_TIMEOUT_MS);
  const codeBuddy =
    options.codeBuddy ??
    new CodeBuddyClient({
      baseUrl: process.env.CODEBUDDY_BASE_URL,
      password: process.env.CODEBUDDY_PASSWORD,
      timeoutMs: codeBuddyTimeoutMs,
    });

  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", async (_request: Request, response: Response) => {
    const connected = !forceFallback && (await codeBuddy.isHealthy());
    response.json({
      ok: true,
      product: "MoveRealm",
      movementDirector: connected ? "codebuddy" : "fallback",
      codeBuddyConnected: connected,
    });
  });

  app.post(
    "/api/scene/analyze",
    upload.single("room"),
    async (request: Request, response: Response) => {
      const startedAt = now();
      const roomFile = request.file;
      const filePath = roomFile?.path;
      if (!filePath || !roomFile) {
        response.status(400).json({ error: "Attach one JPEG, PNG, or WebP room still." });
        return;
      }

      try {
        if (!forceFallback) {
          try {
            const data = await runWithRepair(codeBuddy, scenePrompt(), validateSceneSafety, [
              { type: "image", url: filePath, urlType: "local-path" },
            ]);
            response.json({ data, meta: meta("codebuddy", startedAt, now) });
            return;
          } catch (error) {
            const data = createFallbackSceneProfile({
              width: Number(request.body.width) || undefined,
              height: Number(request.body.height) || undefined,
              byteLength: roomFile.size,
            });
            response.json({
              data,
              meta: meta("fallback", startedAt, now, cleanError(error)),
            });
            return;
          }
        }

        const data = createFallbackSceneProfile({
          width: Number(request.body.width) || undefined,
          height: Number(request.body.height) || undefined,
          byteLength: roomFile.size,
        });
        response.json({ data, meta: meta("fallback", startedAt, now, "Fallback forced by config.") });
      } finally {
        try {
          await removeFile(filePath);
        } catch {
          // This warning is intentionally path- and error-free to avoid leaking room metadata.
          warn(CLEANUP_WARNING);
        }
      }
    },
  );

  app.post("/api/quest/plan", async (request: Request, response: Response) => {
    const startedAt = now();
    const parsed = PlanRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Invalid confirmed scene constraints.", issues: parsed.error.issues });
      return;
    }
    if (!parsed.data.constraints.floorClear) {
      response.status(422).json({ error: "Confirm that the floor is clear before planning." });
      return;
    }

    if (!forceFallback) {
      try {
        const data = await runWithRepair(codeBuddy, planPrompt(parsed.data), (value) =>
          validatePlanSafety(value, parsed.data),
        );
        response.json({ data, meta: meta("codebuddy", startedAt, now) });
        return;
      } catch (error) {
        response.json({
          data: fallbackPlan(parsed.data),
          meta: meta("fallback", startedAt, now, cleanError(error)),
        });
        return;
      }
    }

    response.json({
      data: fallbackPlan(parsed.data),
      meta: meta("fallback", startedAt, now, "Fallback forced by config."),
    });
  });

  app.post("/api/quest/adapt", async (request: Request, response: Response) => {
    const startedAt = now();
    const parsed = AdaptRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Invalid round telemetry.", issues: parsed.error.issues });
      return;
    }

    if (!forceFallback) {
      try {
        const data = await runWithRepair(codeBuddy, adaptationPrompt(parsed.data), (value) =>
          validateAndGroundAdaptation(value, parsed.data),
        );
        response.json({ data, meta: meta("codebuddy", startedAt, now) });
        return;
      } catch (error) {
        response.json({
          data: fallbackAdaptation(parsed.data),
          meta: meta("fallback", startedAt, now, cleanError(error)),
        });
        return;
      }
    }

    response.json({
      data: fallbackAdaptation(parsed.data),
      meta: meta("fallback", startedAt, now, "Fallback forced by config."),
    });
  });

  app.use((error: unknown, _request: Request, response: Response, next: (error?: unknown) => void) => {
    if (error instanceof multer.MulterError) {
      response.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error: error.message });
      return;
    }
    next(error);
  });

  return app;
}
