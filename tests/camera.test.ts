import { afterEach, describe, expect, it, vi } from "vitest";
import { requestCamera } from "../src/lib/camera.js";

interface MockTrack {
  kind: "audio" | "video";
  readyState: MediaStreamTrackState;
  stop: ReturnType<typeof vi.fn>;
}

function mockStream(videoState: MediaStreamTrackState = "live", withAudio = false) {
  const videoTrack: MockTrack = { kind: "video", readyState: videoState, stop: vi.fn() };
  const audioTrack: MockTrack = { kind: "audio", readyState: "live", stop: vi.fn() };
  const tracks = withAudio ? [videoTrack, audioTrack] : [videoTrack];
  const stream = {
    getTracks: () => tracks,
    getVideoTracks: () => [videoTrack],
    getAudioTracks: () => (withAudio ? [audioTrack] : []),
  } as unknown as MediaStream;
  return { audioTrack, stream, videoTrack };
}

function stubGetUserMedia(getUserMedia: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("requestCamera", () => {
  it("requests the preferred local video stream and disables unexpected audio", async () => {
    const { audioTrack, stream } = mockStream("live", true);
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    stubGetUserMedia(getUserMedia);

    await expect(requestCamera()).resolves.toBe(stream);
    expect(getUserMedia).toHaveBeenCalledOnce();
    expect(getUserMedia).toHaveBeenCalledWith({
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30, min: 20 },
      },
      audio: false,
    });
    expect(audioTrack.stop).toHaveBeenCalledOnce();
  });

  it("retries a timed-out device start once with relaxed video constraints", async () => {
    const { stream } = mockStream();
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("Timeout starting video source", "AbortError"))
      .mockResolvedValueOnce(stream);
    stubGetUserMedia(getUserMedia);

    await expect(requestCamera()).resolves.toBe(stream);
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(getUserMedia).toHaveBeenNthCalledWith(2, { video: true, audio: false });
  });

  it("also retries a transient NotReadableError once", async () => {
    const { stream } = mockStream();
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("Camera device is temporarily unavailable", "NotReadableError"))
      .mockResolvedValueOnce(stream);
    stubGetUserMedia(getUserMedia);

    await expect(requestCamera()).resolves.toBe(stream);
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });

  it("recognizes the known Chromium timeout wording even when exposed as a plain Error", async () => {
    const { stream } = mockStream();
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(new Error("Timeout starting video source"))
      .mockResolvedValueOnce(stream);
    stubGetUserMedia(getUserMedia);

    await expect(requestCamera()).resolves.toBe(stream);
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["NotAllowedError", "Camera access is blocked"],
    ["NotFoundError", "No available camera was found"],
  ])("does not retry %s failures", async (name, expectedMessage) => {
    const getUserMedia = vi.fn().mockRejectedValue(new DOMException("private browser detail", name));
    stubGetUserMedia(getUserMedia);

    await expect(requestCamera()).rejects.toThrow(expectedMessage);
    expect(getUserMedia).toHaveBeenCalledOnce();
  });

  it("stops a partial stream before retrying and never returns it", async () => {
    const partial = mockStream("ended", true);
    const fallback = mockStream();
    const getUserMedia = vi.fn().mockResolvedValueOnce(partial.stream).mockResolvedValueOnce(fallback.stream);
    stubGetUserMedia(getUserMedia);

    await expect(requestCamera()).resolves.toBe(fallback.stream);
    expect(partial.videoTrack.stop).toHaveBeenCalledOnce();
    expect(partial.audioTrack.stop).toHaveBeenCalledOnce();
  });

  it("stops a partial fallback stream and sanitizes the final device-start error", async () => {
    const fallback = mockStream("ended", true);
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("/dev/video-private", "NotReadableError"))
      .mockResolvedValueOnce(fallback.stream);
    stubGetUserMedia(getUserMedia);

    const result = requestCamera();
    await expect(result).rejects.toThrow(
      "The camera could not start. Close other apps or browser tabs using it, wait a moment, then try again.",
    );
    await expect(result).rejects.not.toThrow("/dev/video-private");
    expect(fallback.videoTrack.stop).toHaveBeenCalledOnce();
    expect(fallback.audioTrack.stop).toHaveBeenCalledOnce();
  });

  it("offers the camera-free path when media capture is unavailable", async () => {
    vi.stubGlobal("navigator", {});

    await expect(requestCamera()).rejects.toThrow(
      "This browser does not provide camera access. Try the keyboard demo instead.",
    );
  });
});
