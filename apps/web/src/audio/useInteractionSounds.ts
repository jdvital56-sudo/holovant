"use client";

import { useEffect, useRef } from "react";
import { useOrbitStore, getFrontModuleId } from "@/stores/orbitStore";
import { playBlip } from "./audioStore";

/**
 * Turns interaction state changes into sound. Subscribes to the store rather
 * than living inside dispatch, so the interaction model stays unaware that
 * audio exists — and so mouse and gesture input sound identical for free.
 */
export function useInteractionSounds() {
  const frontId = useRef<string | null>(null);
  const expandedId = useRef<string | null>(null);

  useEffect(() => {
    frontId.current = getFrontModuleId();
    expandedId.current = useOrbitStore.getState().expandedId;

    // Fires on every rotation frame during a drag; the work is two string
    // comparisons and it triggers no React render.
    return useOrbitStore.subscribe((state) => {
      const nextFront = getFrontModuleId();
      if (nextFront !== frontId.current) {
        frontId.current = nextFront;
        playBlip("tick");
      }

      if (state.expandedId !== expandedId.current) {
        playBlip(state.expandedId ? "open" : "close");
        expandedId.current = state.expandedId;
      }
    });
  }, []);
}
