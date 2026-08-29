import type { HandPoint } from "@/gestures/engine/handTracking";

/**
 * Two thresholds, not one.
 *
 * A single threshold sits exactly where the measurement is noisiest: fingers
 * hovering at the boundary flicker between pinched and open several times a
 * second, so the carousel opens and closes under a hand that has not moved.
 * The pinch has to close past the lower figure to count, and open past the
 * higher one to release.
 */
export const PINCH_ENTER = 0.42;
export const PINCH_EXIT = 0.62;

/**
 * Thumb-to-index distance, as a fraction of the hand's own size, so it does not
 * change with how close to the camera the hand is.
 *
 * The scale is the larger of palm length and palm width. Either alone shrinks
 * when the hand tilts toward the camera — and a shrinking scale inflates the
 * ratio, which reads as "not pinched" while the fingers are plainly touching.
 * The larger of the two survives a tilt in either direction.
 */
export function pinchDistance(landmarks: HandPoint[]): number {
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const wrist = landmarks[0];
  const middleMcp = landmarks[9];
  const indexMcp = landmarks[5];
  const pinkyMcp = landmarks[17];
  if (!thumbTip || !indexTip || !wrist || !middleMcp || !indexMcp || !pinkyMcp) return 1;

  const palmLength = Math.hypot(wrist[0] - middleMcp[0], wrist[1] - middleMcp[1]);
  const palmWidth = Math.hypot(indexMcp[0] - pinkyMcp[0], indexMcp[1] - pinkyMcp[1]);
  const scale = Math.max(palmLength, palmWidth) || 1;

  const gap = Math.hypot(thumbTip[0] - indexTip[0], thumbTip[1] - indexTip[1]);
  return gap / scale;
}

/**
 * Decides pinched or not from the smoothed distance and what it was a moment
 * ago. Kept apart from the tracking loop so the rule can be checked directly
 * rather than only by pinching at a camera.
 */
export function isPinching(distance: number, wasPinching: boolean): boolean {
  if (wasPinching) return distance < PINCH_EXIT;
  return distance < PINCH_ENTER;
}

/**
 * Evens out the jitter between frames without adding a delay a person would
 * notice. Weighted towards the newest reading: a pinch that takes three frames
 * to register is late, and he said it was late.
 */
export function smoothDistance(previous: number | null, next: number): number {
  if (previous === null) return next;
  return previous * 0.4 + next * 0.6;
}
