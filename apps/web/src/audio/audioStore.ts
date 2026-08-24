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

export function playBlip(blip: Blip) {
  if (!useAudioStore.getState().enabled) return;
  audioEngine.play(blip);
}
