import { create } from "zustand";

export type TrackingStatus = "off" | "starting" | "active" | "error";

interface GestureState {
  status: TrackingStatus;
  currentGesture: string | null;
  confidence: number;
  errorMessage: string | null;
  /** A held pinch: the scene holds completely still, camera drift included. */
  locked: boolean;
  /**
   * Hand readings per second, measured.
   *
   * Shown because the difference between "tracking is broken" and "tracking is
   * running at five readings a second" is invisible from the outside and
   * decides which of them to fix. Below about fifteen, gestures feel dead
   * however good the rest of the code is.
   */
  detectionFps: number;
}

export const useGestureStore = create<GestureState>(() => ({
  status: "off",
  currentGesture: null,
  confidence: 0,
  errorMessage: null,
  locked: false,
  detectionFps: 0,
}));

export function setDetectionFps(detectionFps: number) {
  useGestureStore.setState({ detectionFps });
}

export function setLocked(locked: boolean) {
  if (useGestureStore.getState().locked !== locked) useGestureStore.setState({ locked });
}

export function setTrackingStatus(status: TrackingStatus) {
  useGestureStore.setState({ status, errorMessage: status === "error" ? useGestureStore.getState().errorMessage : null });
}

export function setGestureReading(currentGesture: string | null, confidence: number) {
  useGestureStore.setState({ currentGesture, confidence });
}

export function setTrackingError(message: string) {
  useGestureStore.setState({ status: "error", errorMessage: message });
}
