import { useCallback, useEffect, useRef, useState } from "react";
import type { PoseFrame } from "../pose/types";
import { drawPose } from "../pose/drawPose";

interface CameraStageProps {
  stream?: MediaStream;
  pose?: PoseFrame;
  attachVideo: (node: HTMLVideoElement | null) => void;
  className?: string;
  showGuide?: boolean;
  demo?: boolean;
  onPreviewReadyChange?: (ready: boolean) => void;
  onPreviewError?: (message: string) => void;
  children?: React.ReactNode;
}

export function CameraStage({
  stream,
  pose,
  attachVideo,
  className = "",
  showGuide = false,
  demo = false,
  onPreviewReadyChange,
  onPreviewError,
  children,
}: CameraStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [previewReady, setPreviewReady] = useState(false);

  const bindVideo = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    attachVideo(node);
  }, [attachVideo]);

  useEffect(() => {
    if (canvasRef.current) drawPose(canvasRef.current, pose);
  }, [pose]);

  useEffect(() => onPreviewReadyChange?.(previewReady), [onPreviewReadyChange, previewReady]);

  useEffect(() => {
    if (demo) return;
    const video = videoRef.current;
    if (!video) return;
    setPreviewReady(false);
    if (video.srcObject !== stream) video.srcObject = stream ?? null;
    const unavailable = () => {
      setPreviewReady(false);
      onPreviewError?.(
        "The camera preview stopped. Try the camera again or use the guided demo.",
      );
    };
    const tracks = stream?.getVideoTracks() ?? [];
    tracks.forEach((track) => track.addEventListener("ended", unavailable));
    if (stream) {
      // A retry replaces the stream without remounting this video. Rebind the
      // local pose engine as well as srcObject so tracking follows stream 2.
      attachVideo(video);
      void video.play().catch(() => {
        setPreviewReady(false);
        onPreviewError?.(
          "The camera preview could not start. Try the camera again or use the guided demo.",
        );
      });
    }
    return () => {
      tracks.forEach((track) => track.removeEventListener("ended", unavailable));
      if (video.srcObject === stream) video.srcObject = null;
    };
  }, [attachVideo, demo, onPreviewError, stream]);

  return (
    <div className={`camera-stage ${demo ? "camera-stage--demo" : ""} ${className}`}>
      {demo ? (
        <div className="demo-room" aria-label="Illustrated constrained demo room">
          <div className="demo-room__window" />
          <div className="demo-room__desk" />
          <div className="demo-room__chair" />
          <div className="demo-room__plant" />
          <div className="demo-room__floor" />
        </div>
      ) : (
        <video
          ref={bindVideo}
          className="camera-stage__video"
          autoPlay
          muted
          playsInline
          aria-label={stream ? "Live camera preview" : "Camera preview unavailable"}
          onPlaying={() => setPreviewReady(true)}
          onEmptied={() => setPreviewReady(false)}
        />
      )}
      <canvas ref={canvasRef} className="camera-stage__pose" aria-hidden="true" />
      <div className="camera-stage__grade" aria-hidden="true" />
      {showGuide && (
        <div className="camera-guide" aria-hidden="true">
          <span className="camera-guide__corner camera-guide__corner--tl" />
          <span className="camera-guide__corner camera-guide__corner--tr" />
          <span className="camera-guide__corner camera-guide__corner--bl" />
          <span className="camera-guide__corner camera-guide__corner--br" />
          <span className="camera-guide__floor" />
        </div>
      )}
      {children}
      {!demo && stream && !previewReady && (
        <div className="camera-preview-wait" role="status" aria-live="polite">
          Starting camera preview…
        </div>
      )}
    </div>
  );
}
