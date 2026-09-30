import { create } from "zustand";
import { audioEngine, type Blip } from "./AudioEngine";

interface AudioState {
  enabled: boolean;
}

export const useAudioStore = create<AudioState>(() => ({ enabled: false }));

/** Toggling is the user gesture that unlocks playback, so it starts the context. */
export async function toggleAudio() {
  if (useAudioStore.getState().enabled) {
    audioEngine.stop();
    useAudioStore.setState({ enabled: false });
    return;
  }
  await audioEngine.start();
  useAudioStore.setState({ enabled: true });
  audioEngine.play("confirm");
}

/**
 * Turns the sounds on if they are off, and never off.
 *
 * For a click that already counts as the gesture the browser demands. Turning
 * the voice on is one: the tone that says "heard you, thinking" is part of
 * talking to it, and it was silent for every user who had not separately
 * found the AUDIO switch — so a question met a second of nothing.
 */
export async function ensureAudio() {
  if (useAudioStore.getState().enabled) return;
  await audioEngine.start();
  useAudioStore.setState({ enabled: true });
}

export function playBlip(blip: Blip) {
  if (!useAudioStore.getState().enabled) return;
  audioEngine.play(blip);
}
