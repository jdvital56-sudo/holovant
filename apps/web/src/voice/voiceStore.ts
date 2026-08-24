import { create } from "zustand";

export type VoiceStatus = "off" | "starting" | "listening" | "error";

interface VoiceState {
  status: VoiceStatus;
  /** What the recogniser last heard, shown so a missed command is diagnosable. */
  transcript: string;
  /** Human-readable description of the command that matched, or null. */
  lastCommand: string | null;
  errorMessage: string | null;
}

export const useVoiceStore = create<VoiceState>(() => ({
  status: "off",
  transcript: "",
  lastCommand: null,
  errorMessage: null,
}));

export function setVoiceStatus(status: VoiceStatus) {
  useVoiceStore.setState({ status, ...(status !== "error" ? { errorMessage: null } : {}) });
}

export function setTranscript(transcript: string) {
  useVoiceStore.setState({ transcript });
}

export function setLastCommand(lastCommand: string | null) {
  useVoiceStore.setState({ lastCommand });
}

export function setVoiceError(errorMessage: string) {
  useVoiceStore.setState({ status: "error", errorMessage });
}
