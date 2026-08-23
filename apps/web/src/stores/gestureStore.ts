import { create } from "zustand";

export type TrackingStatus = "off" | "starting" | "active" | "error";

interface GestureState {
  status: TrackingStatus;
  currentGesture: string | null;
  confidence: number;
  errorMessage: string | null;
}

export const useGestureStore = create<GestureState>(() => ({
  status: "off",
  currentGesture: null,
  confidence: 0,
  errorMessage: null,
}));

export function setTrackingStatus(status: TrackingStatus) {
  useGestureStore.setState({ status, errorMessage: status === "error" ? useGestureStore.getState().errorMessage : null });
}

export function setGestureReading(currentGesture: string | null, confidence: number) {
  useGestureStore.setState({ currentGesture, confidence });
}

export function setTrackingError(message: string) {
  useGestureStore.setState({ status: "error", errorMessage: message });
}
