"use client";

import { useEffect } from "react";
import { useVolumeStore } from "@/audio/volumeStore";
import { useOrbitStore } from "@/stores/orbitStore";
import { useVitaStore } from "@/stores/vitaStore";
import { usePlayStore } from "@/voice/playMusic";
import { useVoiceStore } from "@/voice/voiceStore";

/**
 * Read-only state for the browser test, and only when the page is opened with
 * ?e2e in its address.
 *
 * The voice test first read the result of each command off the screen, and
 * what is on screen is a label in capitals that disappears after two and a
 * half seconds — a pause and a misread label looked the same. A test that
 * cannot tell whether the music paused cannot be trusted to say that it did.
 */
export function TestProbe() {
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("e2e")) return;
    (window as unknown as { __holovant: unknown }).__holovant = {
      volume: () => useVolumeStore.getState().level,
      paused: () => usePlayStore.getState().paused,
      playing: () => usePlayStore.getState().status,
      face: () => useVitaStore.getState().visible,
      open: () => useOrbitStore.getState().expandedId,
      lastCommand: () => useVoiceStore.getState().lastCommand,
    };
  }, []);
  return null;
}
