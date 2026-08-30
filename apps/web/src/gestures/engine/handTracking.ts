"use client";

// Type-only import: erased at compile time, so it does not pull MediaPipe
// into the bundle. The library itself is loaded on demand below.
import type { HandLandmarker } from "@mediapipe/tasks-vision";
import { delegatesToTry, type Delegate } from "@/gestures/engine/delegateChoice";
import { FrameGate } from "@/gestures/engine/frameGate";
import { HandRateMeter, type HandRateSample } from "@/gestures/engine/rateMeter";

export type { Delegate };

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

let landmarkerPromise: Promise<HandLandmarker> | null = null;

/**
 * Which processor won the fallback below. Recorded rather than assumed: the
 * fall from the graphics card to the main processor is silent, costs several
 * times as much per detection, and is one of the few things that holds a rate
 * at ten to fifteen with everything else in order.
 */
let activeDelegate: Delegate | null = null;

/** Which one to reach for first. Changing it discards the loaded model. */
let preferredDelegate: Delegate = "GPU";

/**
 * Chooses where detection runs, and throws away the loaded model so the next
 * start rebuilds on the choice. Without the discard the cached model would win
 * and the switch would do nothing while appearing to work — a promise the
 * interface could not keep.
 */
export function setPreferredDelegate(delegate: Delegate) {
  if (delegate === preferredDelegate) return;
  preferredDelegate = delegate;
  const loaded = landmarkerPromise;
  landmarkerPromise = null;
  activeDelegate = null;
  void loaded?.then((landmarker) => landmarker.close()).catch(() => {});
}

export function getPreferredDelegate(): Delegate {
  return preferredDelegate;
}

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
      const candidates = delegatesToTry(preferredDelegate);
      let lastError: unknown;
      for (const delegate of candidates) {
        try {
          const landmarker = await HandLandmarker.createFromOptions(vision, {
            ...options,
            baseOptions: { ...options.baseOptions, delegate },
          });
          activeDelegate = delegate;
          return landmarker;
        } catch (err) {
          lastError = err;
        }
      }
      throw lastError;
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
    onSample?: (sample: HandRateSample) => void,
  ) {
    this.stopped = false;
    this.video = video;

    this.stream = await navigator.mediaDevices.getUserMedia({
      // The frame rate is asked for and not merely hoped for. Without it the
      // driver picks, and a camera that has quietly settled on fifteen looks
      // exactly like one that cannot do better. Asked, the number the camera
      // reports back becomes an answer rather than a default.
      //
      // The frame is back at 640x480. It was tried at a quarter of the pixels
      // on the theory that part of a detection's cost is carrying the picture
      // to the model: measured, 79ms became 92ms, which against a drift of
      // some fifteen milliseconds between readings means it did nothing. A
      // change that did not do what it was made for does not get to stay, and
      // the larger frame is the more precise one.
      video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
      audio: false,
    });
    if (this.stopped) {
      this.stream.getTracks().forEach((t) => t.stop());
      return;
    }

    // What the camera says it will deliver, which is not always what arrives —
    // and the difference between the two is the whole diagnosis. A camera that
    // negotiated fifteen in a dim room is a different fault from a machine too
    // busy to look at thirty. Not every browser answers; null when it will not.
    const settings = this.stream.getVideoTracks()[0]?.getSettings();
    const cameraFps = settings?.frameRate ?? null;
    const cameraSize =
      settings?.width && settings?.height ? { width: settings.width, height: settings.height } : null;
    onSample?.({
      fps: null,
      lowFps: null,
      searchMs: null,
      followMs: null,
      cameraFps,
      cameraSize,
      delegate: activeDelegate,
    });

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
    // Measured, not assumed. How fast readings actually arrive decides whether
    // gestures can work on this machine at all, so it is reported rather than
    // guessed at — and reported every window, including the windows in which
    // nothing arrived, because a loop that keeps turning over a video that has
    // stopped delivering frames would otherwise leave its last good number on
    // screen for the rest of the session.
    const meter = new HandRateMeter(performance.now());
    const gate = new FrameGate();

    const loop = () => {
      if (this.stopped || !this.video) return;
      const v = this.video;
      const ready = v.videoWidth > 0 && v.readyState >= 2;
      // Read once. The clock moves on while detection runs, so a second reading
      // would let the gate and the meter disagree about which frame this turn
      // was, and the count would drift from what was actually looked at.
      const frameTime = ready ? v.currentTime : null;
      let detectMs: number | null = null;
      let foundHand = false;
      if (gate.isNew(frameTime)) {
        // detectForVideo requires strictly increasing timestamps.
        const ts = Math.max(performance.now(), lastTimestamp + 1);
        lastTimestamp = ts;
        const startedAt = performance.now();
        let hand: HandPoint[] | null = null;
        let failed = false;
        try {
          const result = landmarker.detectForVideo(v, ts);
          const landmarks = result.landmarks?.[0] ?? null;
          hand = landmarks ? landmarks.map((p): HandPoint => [p.x, p.y, p.z]) : null;
        } catch {
          failed = true;
        }
        // Only the looking is timed — not what the orbit then does with the
        // answer, which would fold this app's own work into a number meant to
        // describe the machine's. Timed whether it found a hand or threw.
        detectMs = performance.now() - startedAt;
        foundHand = hand !== null;
        onResult(failed ? null : hand);
      }
      const closed = meter.observe(performance.now(), frameTime, detectMs, foundHand);
      if (closed !== null) onSample?.({ ...closed, cameraFps, cameraSize, delegate: activeDelegate });
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
