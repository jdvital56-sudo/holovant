export type InputSource = "mouse" | "keyboard" | "gesture" | "voice";

/**
 * The single contract both the mouse/keyboard adapter and the MediaPipe
 * hand-tracking adapter emit onto. Orbit/card code subscribes to this bus
 * only — never to raw DOM mouse events or raw MediaPipe landmarks — which is
 * what makes hand-tracking a strictly optional, swappable layer instead of
 * a hard dependency of the core interaction model.
 */
export type InteractionEvent =
  | { type: "rotate"; direction: "left" | "right"; source: InputSource; confidence?: number }
  | { type: "select"; cardId: string; source: InputSource; confidence?: number }
  | { type: "expand"; cardId: string; source: InputSource; confidence?: number }
  | { type: "collapse"; source: InputSource; confidence?: number }
  | { type: "grab"; cardId: string; source: "gesture"; confidence?: number }
  | { type: "release"; cardId: string; source: "gesture"; confidence?: number }
  | { type: "freeze"; active: boolean; source: "gesture"; confidence?: number }
  /** Reserved no-op for a future AI wake feature (Phase 2). */
  | { type: "wakeGestureDetected"; source: "gesture"; confidence?: number };

export type GestureName =
  | "swipeLeft"
  | "swipeRight"
  | "pinch"
  | "pinchRelease"
  | "pullTowardCamera"
  | "pushAway"
  | "palmStill"
  | "circle";

export interface GestureReading {
  name: GestureName;
  confidence: number;
}
