import type { HandPoint } from "./engine/handTracking";

type Listener = (points: HandPoint[] | null) => void;

const listeners = new Set<Listener>();

/**
 * Per-frame landmark delivery for the camera preview. Deliberately outside
 * React state: at 60fps a store write would re-render the whole HUD every
 * frame just to move a few dots.
 */
export function publishLandmarks(points: HandPoint[] | null) {
  listeners.forEach((l) => l(points));
}

export function subscribeLandmarks(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
