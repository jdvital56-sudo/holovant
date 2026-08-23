import type { HandPoint } from "@/gestures/engine/handTracking";

export const PINCH_THRESHOLD = 0.55;

/** Thumb-to-index distance, normalized by wrist-to-middle-knuckle span so it's scale-invariant. */
export function pinchDistance(landmarks: HandPoint[]): number {
  const [thumbTip, indexTip, wrist, middleMcp] = [landmarks[4], landmarks[8], landmarks[0], landmarks[9]];
  const scale = Math.hypot(wrist[0] - middleMcp[0], wrist[1] - middleMcp[1]) || 1;
  const dist = Math.hypot(thumbTip[0] - indexTip[0], thumbTip[1] - indexTip[1]);
  return dist / scale;
}
