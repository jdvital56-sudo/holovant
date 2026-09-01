import { create } from "zustand";

export type VoiceStatus = "off" | "starting" | "listening" | "error";

interface VoiceState {
  status: VoiceStatus;
  /** What the recogniser last heard, shown so a missed command is diagnosable. */
  transcript: string;
  /** Human-readable description of the command that matched, or null. */
  lastCommand: string | null;
  /**
   * What the microphone caught while the assistant itself was talking.
   *
   * He says "стоп" over a long answer and it carries on reading. From outside,
   * a word that never reached the recogniser and a word that reached it and
   * was ignored look exactly the same — and they have opposite fixes. This is
   * the only way to tell them apart: if his "стоп" is not in this list, the
   * microphone never heard it over the speakers.
   */
  heardWhileSpeaking: string[];
  errorMessage: string | null;
}

export const useVoiceStore = create<VoiceState>(() => ({
  status: "off",
  transcript: "",
  lastCommand: null,
  heardWhileSpeaking: [],
  errorMessage: null,
}));

/** Keeps the last few, newest last — enough to read back, not enough to clutter. */
export function noteHeardWhileSpeaking(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return;
  const kept = useVoiceStore.getState().heardWhileSpeaking;
  if (kept[kept.length - 1] === trimmed) return;
  useVoiceStore.setState({ heardWhileSpeaking: [...kept, trimmed].slice(-3) });
}

export function clearHeardWhileSpeaking() {
  if (useVoiceStore.getState().heardWhileSpeaking.length) {
    useVoiceStore.setState({ heardWhileSpeaking: [] });
  }
}

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
