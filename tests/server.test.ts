import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp, resolveCodeBuddyTimeoutMs } from "../server/app.js";
import { CodeBuddyError } from "../server/codebuddy.js";
import { createFallbackPlan, DEMO_SCENES } from "../src/shared/fallbacks.js";
import type { PlanRequest } from "../src/shared/contracts.js";

const planRequest: PlanRequest = {
  scene: DEMO_SCENES.open,
  constraints: {
    floorClear: true,
    noJumping: true,
    sideStepRange: "wide",
    permittedDirections: DEMO_SCENES.open.permittedDirections,
  },
  intent: { durationSeconds: 180, energy: "balanced", noJumping: true },
};

describe("MoveRealm API", () => {
  it("keeps adapter overrides inside the end-to-end browser deadline", () => {
    expect(resolveCodeBuddyTimeoutMs("120000")).toBe(45_000);
    expect(resolveCodeBuddyTimeoutMs("12000")).toBe(12_000);
    expect(resolveCodeBuddyTimeoutMs("not-a-number")).toBe(45_000);
  });

  it("reports the fallback mode honestly", async () => {
    const app = createApp({ forceFallback: true });
    const response = await request(app).get("/api/health").expect(200);
    expect(response.body.movementDirector).toBe("fallback");
    expect(response.body.codeBuddyConnected).toBe(false);
  });

  it("requires an explicit floor-clear confirmation", async () => {
    const app = createApp({ forceFallback: true });
    const response = await request(app)
      .post("/api/quest/plan")
      .send({
        ...planRequest,
        constraints: { ...planRequest.constraints, floorClear: false },
      })
      .expect(422);
    expect(response.body.error).toMatch(/floor is clear/i);
  });

  it("serves a typed deterministic plan and adaptation", async () => {
    const app = createApp({ forceFallback: true });
    const planResponse = await request(app).post("/api/quest/plan").send(planRequest).expect(200);
    expect(planResponse.body.meta.source).toBe("fallback");
    expect(planResponse.body.data.rounds).toHaveLength(3);

    const adaptResponse = await request(app)
      .post("/api/quest/adapt")
      .send({
        telemetry: {
          roundId: "round-1",
          movementId: planResponse.body.data.rounds[0].movementId,
          completionRate: 4 / 12,
          movementRange: 0.54,
          poseConfidence: 0.88,
          trackingFps: 27,
          trackingMode: "pose",
          targetsPresented: 12,
          targetsCompleted: 4,
          feedback: "too_hard",
        },
        nextRoundSeed: planResponse.body.data.rounds[1],
        constraints: planRequest.constraints,
        intent: planRequest.intent,
      })
      .expect(200);
    expect(adaptResponse.body.data.reason).toBe(
      "4/12 targets; range 54%; pose confidence 88%; you chose Too hard. Next: closer, slower, fewer targets.",
    );
    expect(adaptResponse.body.data.nextRound.rangeScale).toBeLessThan(planResponse.body.data.rounds[1].rangeScale);
  });

  it("accepts a room still and returns a conservative profile", async () => {
    const uploadDirectory = await mkdtemp(join(tmpdir(), "moverealm-upload-test-"));
    try {
      const app = createApp({ forceFallback: true, uploadDirectory });
      const response = await request(app)
        .post("/api/scene/analyze")
        .field("width", "480")
        .field("height", "720")
        .attach("room", Buffer.from("fake-jpeg-content"), {
          filename: "room.jpg",
          contentType: "image/jpeg",
        })
        .expect(200);
      expect(response.body.data.spaceClass).toBe("tight");
      expect(response.body.data.confidence).toBeLessThan(0.5);
      expect(response.body.meta.source).toBe("fallback");
      expect(await readdir(uploadDirectory)).toEqual([]);
    } finally {
      await rm(uploadDirectory, { recursive: true, force: true });
    }
  });

  it("retries malformed CodeBuddy output once and accepts a repaired plan", async () => {
    const livePlan = createFallbackPlan(planRequest);
    const codeBuddy = {
      isHealthy: vi.fn(async () => true),
      runStructured: vi
        .fn()
        .mockRejectedValueOnce(new CodeBuddyError("CodeBuddy output failed validation: bad movement"))
        .mockResolvedValue(livePlan),
    };
    const app = createApp({ forceFallback: false, codeBuddy });
    const response = await request(app).post("/api/quest/plan").send(planRequest).expect(200);
    expect(response.body.meta.source).toBe("codebuddy");
    expect(codeBuddy.runStructured).toHaveBeenCalledTimes(2);
  });

  it("makes exactly one plan repair attempt before returning a labelled fallback", async () => {
    const codeBuddy = {
      isHealthy: vi.fn(async () => true),
      runStructured: vi.fn().mockRejectedValue(
        new CodeBuddyError("CodeBuddy output failed validation: duration mismatch"),
      ),
    };
    const app = createApp({ forceFallback: false, codeBuddy });
    const response = await request(app).post("/api/quest/plan").send(planRequest).expect(200);

    expect(response.body.meta.source).toBe("fallback");
    expect(response.body.meta.label).toBe("Deterministic fallback");
    expect(codeBuddy.runStructured).toHaveBeenCalledTimes(2);
  });

  it("replaces untrusted adaptation prose with a telemetry-grounded trace", async () => {
    const plan = createFallbackPlan(planRequest);
    const adaptationRequest = {
      telemetry: {
        roundId: "round-1",
        movementId: plan.rounds[0].movementId,
        completionRate: 4 / 12,
        movementRange: 0.54,
        poseConfidence: 0.88,
        trackingFps: 27,
        trackingMode: "pose" as const,
        targetsPresented: 12,
        targetsCompleted: 4,
        feedback: "too_hard" as const,
      },
      nextRoundSeed: plan.rounds[1],
      constraints: planRequest.constraints,
      intent: planRequest.intent,
    };
    const candidate = createFallbackPlan(planRequest).rounds[1];
    const codeBuddy = {
      isHealthy: vi.fn(async () => true),
      runStructured: vi.fn().mockResolvedValue({
        nextRound: {
          ...candidate,
          rangeScale: candidate.rangeScale - 0.1,
          tempo: candidate.tempo - 0.1,
        },
        reason: "Your posture shows fatigue and poor form.",
        adjustments: ["target_envelope", "tempo"],
      }),
    };
    const app = createApp({ forceFallback: false, codeBuddy });
    const response = await request(app)
      .post("/api/quest/adapt")
      .send(adaptationRequest)
      .expect(200);

    expect(response.body.meta.source).toBe("codebuddy");
    expect(response.body.data.reason).toBe(
      "4/12 targets; range 54%; pose confidence 88%; you chose Too hard. Next: closer, slower.",
    );
    expect(response.body.data.reason).not.toMatch(/fatigue|form/i);
  });

  it("uses the labelled fallback immediately on a transport timeout", async () => {
    const codeBuddy = {
      isHealthy: vi.fn(async () => true),
      runStructured: vi.fn().mockRejectedValue(new Error("request timed out")),
    };
    const app = createApp({ forceFallback: false, codeBuddy });
    const response = await request(app).post("/api/quest/plan").send(planRequest).expect(200);
    expect(response.body.meta.source).toBe("fallback");
    expect(response.body.meta.detail).toMatch(/timed out/i);
    expect(codeBuddy.runStructured).toHaveBeenCalledTimes(1);
  });

  it("falls back after one failed repair and removes the attached room still", async () => {
    const uploadDirectory = await mkdtemp(join(tmpdir(), "moverealm-repair-test-"));
    const codeBuddy = {
      isHealthy: vi.fn(async () => true),
      runStructured: vi
        .fn()
        .mockRejectedValue(
          new CodeBuddyError("CodeBuddy output failed validation: invalid room profile"),
        ),
    };
    try {
      const app = createApp({ forceFallback: false, codeBuddy, uploadDirectory });
      const response = await request(app)
        .post("/api/scene/analyze")
        .field("width", "640")
        .field("height", "480")
        .attach("room", Buffer.from("fake-jpeg-content"), {
          filename: "untrusted-extension.exe",
          contentType: "image/png",
        })
        .expect(200);

      expect(response.body.meta.source).toBe("fallback");
      expect(codeBuddy.runStructured).toHaveBeenCalledTimes(2);
      const firstAttachment = codeBuddy.runStructured.mock.calls[0]?.[2]?.[0];
      const repairAttachment = codeBuddy.runStructured.mock.calls[1]?.[2]?.[0];
      expect(firstAttachment?.url).toBe(repairAttachment?.url);
      expect(firstAttachment?.url).toMatch(/\.png$/);
      expect(await readdir(uploadDirectory)).toEqual([]);
    } finally {
      await rm(uploadDirectory, { recursive: true, force: true });
    }
  });

  it("removes stale orphaned room stills when the adapter starts", async () => {
    const uploadDirectory = await mkdtemp(join(tmpdir(), "moverealm-orphan-test-"));
    const orphan = join(uploadDirectory, "room-00000000-0000-4000-8000-000000000000.jpg");
    try {
      await writeFile(orphan, "orphaned-room-still");
      createApp({ forceFallback: true, uploadDirectory, orphanMaxAgeMs: 0 });
      expect(await readdir(uploadDirectory)).toEqual([]);
    } finally {
      await rm(uploadDirectory, { recursive: true, force: true });
    }
  });

  it("warns about unlink failure without exposing the path or underlying error", async () => {
    const uploadDirectory = await mkdtemp(join(tmpdir(), "moverealm-warning-test-"));
    const warn = vi.fn();
    try {
      const app = createApp({
        forceFallback: true,
        uploadDirectory,
        removeFile: async () => {
          throw new Error("secret-local-path /private/room.jpg");
        },
        warn,
      });
      await request(app)
        .post("/api/scene/analyze")
        .attach("room", Buffer.from("fake-jpeg-content"), {
          filename: "room.jpg",
          contentType: "image/jpeg",
        })
        .expect(200);

      expect(warn).toHaveBeenCalledTimes(1);
      const warning = String(warn.mock.calls[0]?.[0]);
      expect(warning).toMatch(/temporary room still/i);
      expect(warning).not.toMatch(/secret-local-path|private|room\.jpg/i);
    } finally {
      await rm(uploadDirectory, { recursive: true, force: true });
    }
  });

  it("rejects malformed telemetry at the adapter boundary", async () => {
    const app = createApp({ forceFallback: true });
    await request(app)
      .post("/api/quest/adapt")
      .send({ telemetry: { movementId: "jump" } })
      .expect(400);
  });
});
