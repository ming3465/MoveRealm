export interface CoverTransform {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

export function coverTransform(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): CoverTransform {
  const safeSourceWidth = Math.max(1, sourceWidth);
  const safeSourceHeight = Math.max(1, sourceHeight);
  const scale = Math.max(targetWidth / safeSourceWidth, targetHeight / safeSourceHeight);
  const width = safeSourceWidth * scale;
  const height = safeSourceHeight * scale;
  return {
    width,
    height,
    offsetX: (targetWidth - width) / 2,
    offsetY: (targetHeight - height) / 2,
  };
}

export function pointInCover(
  x: number,
  y: number,
  transform: CoverTransform,
  targetWidth: number,
  targetHeight: number,
): { x: number; y: number } {
  return {
    x: (transform.offsetX + x * transform.width) / Math.max(1, targetWidth),
    y: (transform.offsetY + y * transform.height) / Math.max(1, targetHeight),
  };
}
