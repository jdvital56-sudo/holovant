"use client";

// Type-only import: erased at compile time, so it does not pull MediaPipe
// into the bundle. The library itself is loaded on demand below.
import type { HandLandmarker } from "@mediapipe/tasks-vision";

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

let landmarkerPromise: Promise<HandLandmarker> | null = null;

/**
 * Loads MediaPipe only when tracking is actually switched on. Users who never
 * enable hand tracking — the default — never download the vision library.
 * Falls back to CPU inference when the GPU delegate is unavailable, which
 * otherwise fails on some drivers with no hand ever being reported.
 */
function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = import("@mediapipe/tasks-vision").then(async ({ FilesetResolver, HandLandmarker }) => {
      const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
      const options = {
        baseOptions: { modelAssetPath: MODEL_URL },
        runningMode: "VIDEO" as const,
        numHands: 1,
      };
      try {
        return await HandLandmarker.createFromOptions(vision, {
          ...options,
          baseOptions: { ...options.baseOptions, delegate: "GPU" as const },
        });
      } catch {
        return HandLandmarker.createFromOptions(vision, {
          ...options,
          baseOptions: { ...options.baseOptions, delegate: "CPU" as const },
        });
      }
    });
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
  if (err instanceof Error && err.message) return err.message;
  return "Could not start hand tracking.";
}

export class HandTrackingEngine {
  private stream: MediaStream | null = null;
  private rafId: number | null = null;
  private stopped = true;
  private video: HTMLVideoElement | null = null;

  /**
   * Drives detection off a video element owned by the React tree. Keeping the
   * element mounted (rather than creating a detached one) is what guarantees
   * the browser actually decodes frames for it.
   */
  async start(
    video: HTMLVideoElement,
    onResult: (landmarks: HandPoint[] | null) => void,
    onRate?: (fps: number) => void,
  ) {
    this.stopped = false;
    this.video = video;

    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    if (this.stopped) {
      this.stream.getTracks().forEach((t) => t.stop());
      return;
    }

    video.srcObject = this.stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();

    // play() can resolve before the first frame has dimensions; detection on a
    // zero-sized frame silently yields no hands forever.
    if (!video.videoWidth) {
      await new Promise<void>((resolve) => {
        const done = () => resolve();
        video.addEventListener("loadeddata", done, { once: true });
        setTimeout(done, 3000);
      });
    }

    const landmarker = await getLandmarker();
    if (this.stopped) return;

    let lastTimestamp = -1;
    let detections = 0;
    let rateWindowStart = performance.now();

    const loop = () => {
      if (this.stopped || !this.video) return;
      const v = this.video;
      if (v.videoWidth > 0 && v.readyState >= 2) {
        // detectForVideo requires strictly increasing timestamps.
        const ts = Math.max(performance.now(), lastTimestamp + 1);
        lastTimestamp = ts;
        try {
          const result = landmarker.detectForVideo(v, ts);
          const hand = result.landmarks?.[0] ?? null;
          onResult(hand ? hand.map((p): HandPoint => [p.x, p.y, p.z]) : null);
        } catch {
          onResult(null);
        }

        // Measured, not assumed. Detection runs as fast as the machine allows,
        // and how fast that actually is decides whether gestures can work here
        // at all — so it is reported rather than guessed at.
        detections++;
        const sinceWindow = performance.now() - rateWindowStart;
        if (sinceWindow >= 1000) {
          onRate?.(Math.round((detections * 1000) / sinceWindow));
          detections = 0;
          rateWindowStart = performance.now();
        }
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    this.stopped = true;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    if (this.video) this.video.srcObject = null;
    this.video = null;
    this.stream = null;
  }
}
