import { describe, expect, it } from "vitest";
import { adaptationPrompt, planPrompt, scenePrompt } from "../server/prompts.js";
import type { AdaptRequest, PlanRequest } from "../src/shared/contracts.js";

function request(overrides: Partial<PlanRequest> = {}): PlanRequest {
  return {
    scene: {
      spaceClass: "tight",
      obstacles: [],
      permittedDirections: ["vertical", "center"],
      confidence: 0.8,
      summary: "A constrained central lane is visible.",
    },
    constraints: {
      floorClear: true,
      noJumping: true,
      sideStepRange: "none",
      permittedDirections: ["vertical", "center"],
    },
    intent: { durationSeconds: 180, energy: "balanced", noJumping: true },
    ...overrides,
  };
}

describe("Movement Director prompts", () => {
  it("gives scene analysis an explicit conservative classification order", () => {
    const prompt = scenePrompt();

    expect(prompt).toContain("Choose uncertain only when cropping, blur, darkness, or occlusion");
    expect(prompt).toContain("the lower frame does not show the floor at all");
    expect(prompt).toContain("Never return an empty permittedDirections array");
    expect(prompt).toContain("choose open when the centre plus both lateral movement lanes are visibly clear");
    expect(prompt).toContain("Ordinary furniture alone does not make a visible room uncertain");
  });

  it("makes a center-only plan reach-only at the end of the prompt", () => {
    const prompt = planPrompt(request({
      scene: {
        spaceClass: "tight",
        obstacles: [],
        permittedDirections: ["center"],
        confidence: 0.8,
        summary: "Only the central lane is visible.",
      },
      constraints: {
        floorClear: true,
        noJumping: true,
        sideStepRange: "none",
        permittedDirections: ["center"],
      },
    }));

    expect(prompt).toContain("The only allowed movementId values are: reach.");
    expect(prompt).toContain("reach rangeScale must be <= 0.62.");
    expect(prompt).toContain("squat is forbidden.");
    expect(prompt).toContain("side_step is forbidden.");
    expect(prompt).toContain("Use movementId reach, reach, and reach for");
  });

  it("permits all validated movements only for an open lateral room", () => {
    const prompt = planPrompt(request({
      scene: {
        spaceClass: "open",
        obstacles: [],
        permittedDirections: ["vertical", "left", "right", "center"],
        confidence: 0.9,
        summary: "All movement lanes are clear.",
      },
      constraints: {
        floorClear: true,
        noJumping: true,
        sideStepRange: "wide",
        permittedDirections: ["vertical", "left", "right", "center"],
      },
    }));

    expect(prompt).toContain("The only allowed movementId values are: reach, squat, side_step.");
    expect(prompt).toContain("reach rangeScale must be <= 1.00.");
    expect(prompt).toContain("side_step rangeScale must be <= 1.00.");
    expect(prompt).toContain("Use movementId reach, side_step, and squat for");
  });

  it("keeps an uncertain room reach-only even if lateral directions are proposed", () => {
    const prompt = planPrompt(request({
      scene: {
        spaceClass: "uncertain",
        obstacles: [],
        permittedDirections: ["vertical", "left", "right", "center"],
        confidence: 0.4,
        summary: "The floor is partly occluded.",
      },
      constraints: {
        floorClear: true,
        noJumping: true,
        sideStepRange: "wide",
        permittedDirections: ["vertical", "left", "right", "center"],
      },
    }));

    expect(prompt).toContain("The only allowed movementId values are: reach.");
    expect(prompt).toContain("reach rangeScale must be <= 0.62.");
    expect(prompt).toContain("squat is forbidden.");
    expect(prompt).toContain("side_step is forbidden.");
    expect(prompt).toContain("use rangeScale 0.48, 0.52, and 0.56 for rounds 1, 2, and 3 respectively");
  });

  it("maps adaptation fields to the exact accepted adjustment labels", () => {
    const adaptationRequest: AdaptRequest = {
      telemetry: {
        roundId: "round-1",
        movementId: "reach",
        completionRate: 4 / 12,
        movementRange: 0.54,
        poseConfidence: 0,
        trackingFps: 0,
        trackingMode: "keyboard",
        targetsPresented: 12,
        targetsCompleted: 4,
        feedback: "too_hard",
      },
      nextRoundSeed: {
        id: "round-2",
        movementId: "reach",
        durationSeconds: 52,
        targetRate: 10,
        rangeScale: 0.62,
        tempo: 1.05,
        mechanic: "collect_fireflies",
        prompt: "Reach softly to wake the fireflies",
        accent: "mint",
      },
      constraints: request().constraints,
      intent: request().intent,
    };

    const prompt = adaptationPrompt(adaptationRequest);
    expect(prompt).toContain('use "target_envelope" if and only if rangeScale changed');
    expect(prompt).toContain('use "target_rate" if and only if targetRate changed');
    expect(prompt).toContain('Never put JSON field names such as "rangeScale" or "targetRate" in adjustments');
    expect(prompt).toContain("return the prevalidated proportional candidate below exactly");
    expect(prompt).toContain('"rangeScale": 0.46');
    expect(prompt).toContain('"tempo": 0.92');
    expect(prompt).toContain('"targetRate": 9');
    expect(prompt).toContain('"adjustments": [\n    "target_envelope",\n    "tempo",\n    "target_rate"');
  });
});
