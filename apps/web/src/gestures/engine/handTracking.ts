"use client";

import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

let landmarkerPromise: Promise<HandLandmarker> | null = null;

function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = FilesetResolver.forVisionTasks(WASM_BASE).then((vision) =>
      HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numHands: 1,
      }),
    );
  }
  return landmarkerPromise;
}

export type HandPoint = [number, number, number];

/** Translates the raw browser/permission failure into what the user should do about it. */
export function describeTrackingError(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError") return "Camera access denied — allow the camera permission and try again.";
    if (err.name === "NotFoundError") return "No camera found on this device.";
    if (err.name === "NotReadableError") return "Camera is already in use by another app.";
  }
  return "Could not start hand tracking.";
}

export class HandTrackingEngine {
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private rafId: number | null = null;
  private stopped = true;

  async start(onResult: (landmarks: HandPoint[] | null) => void) {
    this.stopped = false;
    const landmarker = await getLandmarker();

    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 480, height: 360 },
      audio: false,
    });
    const video = document.createElement("video");
    video.srcObject = this.stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();
    this.video = video;

    const loop = () => {
      if (this.stopped || !this.video) return;
      const result = landmarker.detectForVideo(this.video, performance.now());
      const hand = result.landmarks?.[0] ?? null;
      onResult(hand ? hand.map((p): HandPoint => [p.x, p.y, p.z]) : null);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    this.stopped = true;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.video = null;
    this.stream = null;
  }
}
