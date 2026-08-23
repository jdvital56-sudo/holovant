/**
 * Hand-tracking ships as an opt-in enhancement layer, never a hard
 * requirement — the app must be 100% usable with mouse/keyboard alone.
 * Users flip this on from a HUD control once camera permission is granted;
 * it does not auto-request the camera on load.
 */
export const FEATURE_FLAGS = {
  handTrackingAvailable: true,
} as const;
