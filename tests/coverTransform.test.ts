import { describe, expect, it } from "vitest";
import { coverTransform, pointInCover } from "../src/pose/coverTransform.js";

describe("camera cover transform", () => {
  it.each([
    [1280, 720, 1280, 720],
    [1280, 720, 800, 1000],
    [720, 1280, 1280, 720],
  ])("keeps the source centre aligned for %ix%i into %ix%i", (sourceWidth, sourceHeight, targetWidth, targetHeight) => {
    const transform = coverTransform(sourceWidth, sourceHeight, targetWidth, targetHeight);
    expect(pointInCover(0.5, 0.5, transform, targetWidth, targetHeight)).toEqual({ x: 0.5, y: 0.5 });
  });

  it("maps a 16:9 camera through the same crop used by a portrait viewport", () => {
    const transform = coverTransform(1280, 720, 800, 1000);
    const leftVisibleEdgeInSource = -transform.offsetX / transform.width;
    const rightVisibleEdgeInSource = (800 - transform.offsetX) / transform.width;
    expect(pointInCover(leftVisibleEdgeInSource, 0.5, transform, 800, 1000).x).toBeCloseTo(0);
    expect(pointInCover(rightVisibleEdgeInSource, 0.5, transform, 800, 1000).x).toBeCloseTo(1);
  });
});
