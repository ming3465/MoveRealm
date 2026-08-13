export async function requestCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser does not provide camera access. Try the keyboard demo instead.");
  }
  return navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "user",
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30, min: 20 },
    },
    audio: false,
  });
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
