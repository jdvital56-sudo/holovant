"use client";

import { useEffect, useRef, type RefObject } from "react";
import { subscribeLandmarks } from "@/gestures/landmarkFeed";

/** Bones drawn between landmark indices, so the hand reads as a hand. */
const CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

interface HandPreviewProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  visible: boolean;
}

/**
 * Live camera thumbnail with the tracked skeleton drawn over it. This is what
 * tells the user whether the camera can actually see their hand — without it,
 * a hand out of frame is indistinguishable from tracking being broken.
 */
export function HandPreview({ videoRef, visible }: HandPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    return subscribeLandmarks((points) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!points) return;

      // Mirrored horizontally to match the flipped video, so the drawn hand
      // sits on top of the user's actual hand in the preview.
      const px = (i: number) => (1 - points[i][0]) * canvas.width;
      const py = (i: number) => points[i][1] * canvas.height;

      ctx.strokeStyle = "rgba(111,179,255,0.85)";
      ctx.lineWidth = 2;
      for (const [a, b] of CONNECTIONS) {
        ctx.beginPath();
        ctx.moveTo(px(a), py(a));
        ctx.lineTo(px(b), py(b));
        ctx.stroke();
      }

      ctx.fillStyle = "#e9eef6";
      for (let i = 0; i < points.length; i++) {
        ctx.beginPath();
        ctx.arc(px(i), py(i), i === 0 || i === 4 || i === 8 ? 4 : 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }, []);

  return (
    <div
      className={[
        "pointer-events-none fixed bottom-4 right-4 z-30 overflow-hidden rounded-2xl border transition-opacity duration-300 sm:bottom-8 sm:right-8",
        visible ? "border-signal/40 opacity-100" : "pointer-events-none border-transparent opacity-0",
      ].join(" ")}
      style={{ width: 200, height: 150 }}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full -scale-x-100 object-cover"
        playsInline
        muted
      />
      <canvas ref={canvasRef} width={200} height={150} className="absolute inset-0 h-full w-full" />
      <div className="absolute bottom-1 left-2 font-mono text-[9px] tracking-wider text-frost/80">CAMERA</div>
    </div>
  );
}
