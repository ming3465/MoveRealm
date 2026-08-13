import type { PoseFrame } from "./types";
import { coverTransform, pointInCover } from "./coverTransform";

const CONNECTIONS: Array<[number, number]> = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
];

let maskCanvas: HTMLCanvasElement | undefined;

export function drawPose(canvas: HTMLCanvasElement, frame?: PoseFrame): void {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }
  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  if (!frame || frame.landmarks.length !== 33) return;
  const cover = coverTransform(frame.sourceWidth, frame.sourceHeight, width, height);
  const mapPoint = (x: number, y: number) => pointInCover(x, y, cover, width, height);

  context.save();
  context.translate(width, 0);
  context.scale(-1, 1);

  if (frame.mask) {
    maskCanvas ??= document.createElement("canvas");
    maskCanvas.width = frame.mask.width;
    maskCanvas.height = frame.mask.height;
    const maskContext = maskCanvas.getContext("2d");
    if (maskContext) {
      const pixels = new Uint8ClampedArray(frame.mask.width * frame.mask.height * 4);
      for (let index = 0; index < frame.mask.alpha.length; index += 1) {
        const alpha = frame.mask.alpha[index];
        pixels[index * 4] = 68;
        pixels[index * 4 + 1] = 255;
        pixels[index * 4 + 2] = 191;
        pixels[index * 4 + 3] = Math.round(alpha * 0.18);
      }
      maskContext.putImageData(
        new ImageData(pixels, frame.mask.width, frame.mask.height),
        0,
        0,
      );
      context.globalCompositeOperation = "screen";
      context.filter = "blur(10px)";
      context.drawImage(maskCanvas, cover.offsetX, cover.offsetY, cover.width, cover.height);
      context.filter = "none";
      context.globalCompositeOperation = "source-over";
    }
  }

  context.strokeStyle = "rgba(150, 255, 216, 0.72)";
  context.lineWidth = 2;
  context.shadowColor = "#67ffc3";
  context.shadowBlur = 8;
  for (const [from, to] of CONNECTIONS) {
    const a = frame.landmarks[from];
    const b = frame.landmarks[to];
    if ((a.visibility ?? 0) < 0.45 || (b.visibility ?? 0) < 0.45) continue;
    context.beginPath();
    const aPoint = mapPoint(a.x, a.y);
    const bPoint = mapPoint(b.x, b.y);
    context.moveTo(aPoint.x * width, aPoint.y * height);
    context.lineTo(bPoint.x * width, bPoint.y * height);
    context.stroke();
  }
  context.fillStyle = "#d6ffe9";
  for (const index of [11, 12, 15, 16, 23, 24, 25, 26, 27, 28]) {
    const landmark = frame.landmarks[index];
    if ((landmark?.visibility ?? 0) < 0.45) continue;
    context.beginPath();
    const displayPoint = mapPoint(landmark.x, landmark.y);
    context.arc(displayPoint.x * width, displayPoint.y * height, 3.2, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}
