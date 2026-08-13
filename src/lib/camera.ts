const PREFERRED_CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    facingMode: "user",
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, min: 20 },
  },
  audio: false,
};

const RELAXED_CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: true,
  audio: false,
};

const RECOVERABLE_CAMERA_ERROR_NAMES = new Set([
  "AbortError",
  "ConstraintNotSatisfiedError",
  "NotReadableError",
  "OverconstrainedError",
  "SourceUnavailableError",
  "TrackStartError",
]);

const PERMISSION_ERROR_NAMES = new Set(["NotAllowedError", "PermissionDeniedError", "SecurityError"]);
const MISSING_DEVICE_ERROR_NAMES = new Set(["DevicesNotFoundError", "NotFoundError"]);

class UnusableCameraStreamError extends Error {
  override name = "UnusableCameraStreamError";
}

function errorName(error: unknown): string {
  if (typeof error !== "object" || error === null || !("name" in error)) return "";
  return typeof error.name === "string" ? error.name : "";
}

function errorMessage(error: unknown): string {
  if (typeof error !== "object" || error === null || !("message" in error)) return "";
  return typeof error.message === "string" ? error.message : "";
}

function isRecoverableCameraError(error: unknown): boolean {
  const name = errorName(error);
  if (PERMISSION_ERROR_NAMES.has(name) || MISSING_DEVICE_ERROR_NAMES.has(name)) return false;
  if (error instanceof UnusableCameraStreamError || RECOVERABLE_CAMERA_ERROR_NAMES.has(name)) return true;

  // Some Chromium builds have surfaced this device-start failure as a plain Error.
  // Match only the known generic wording and never display the browser's raw message.
  return /(?:timeout|could not|failed to) start(?:ing)? video source/i.test(errorMessage(error));
}

function cameraError(error: unknown): Error {
  const name = errorName(error);
  if (PERMISSION_ERROR_NAMES.has(name)) {
    return new Error(
      "Camera access is blocked. Allow camera permission for this site in your browser settings, then try again.",
    );
  }
  if (MISSING_DEVICE_ERROR_NAMES.has(name)) {
    return new Error("No available camera was found. Connect or enable a camera, then try again.");
  }
  if (isRecoverableCameraError(error)) {
    return new Error(
      "The camera could not start. Close other apps or browser tabs using it, wait a moment, then try again.",
    );
  }
  return new Error(
    "Camera access could not start. Check this site's camera permission and use HTTPS or localhost, then try again.",
  );
}

function validateCameraStream(stream: MediaStream): MediaStream {
  const liveVideoTrack = stream.getVideoTracks().some((track) => track.readyState === "live");
  if (!liveVideoTrack) {
    stopCamera(stream);
    throw new UnusableCameraStreamError("Camera returned no live video track.");
  }

  // `audio: false` is a privacy boundary. Stop any unexpected audio track before
  // the stream reaches the rest of the application.
  stream.getAudioTracks().forEach((track) => track.stop());
  return stream;
}

export async function requestCamera(): Promise<MediaStream> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser does not provide camera access. Try the keyboard demo instead.");
  }

  try {
    return validateCameraStream(await navigator.mediaDevices.getUserMedia(PREFERRED_CAMERA_CONSTRAINTS));
  } catch (firstError) {
    if (!isRecoverableCameraError(firstError)) throw cameraError(firstError);
  }

  try {
    return validateCameraStream(await navigator.mediaDevices.getUserMedia(RELAXED_CAMERA_CONSTRAINTS));
  } catch (fallbackError) {
    throw cameraError(fallbackError);
  }
}

export interface CapturedStill {
  blob: Blob;
  previewUrl: string;
  width: number;
  height: number;
}

export async function captureStill(video: HTMLVideoElement): Promise<CapturedStill> {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) throw new Error("The camera is still warming up. Try again in a moment.");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create the room snapshot.");
  context.drawImage(video, 0, 0, width, height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error("Could not encode the room snapshot."))),
      "image/jpeg",
      0.86,
    );
  });
  return { blob, previewUrl: URL.createObjectURL(blob), width, height };
}

export function stopCamera(stream?: MediaStream): void {
  stream?.getTracks().forEach((track) => track.stop());
}
