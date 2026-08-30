"use client";

import { useEffect } from "react";
import { moduleRegistry } from "@/modules/registry";
import { loadAllModuleData, refreshModuleData } from "@/modules/moduleDataStore";
import { usePlayStore } from "@/voice/playMusic";
import { usePlaylistStore } from "@/voice/playlistStore";
import { useGestureStore } from "@/stores/gestureStore";
import { useOrbitStore } from "@/stores/orbitStore";
import { useSpringNumber } from "@/motion/useSpringNumber";
import { CardSprings } from "@holovant/motion-vocabulary";
import { HolographicCard } from "../cards/HolographicCard";

/**
 * Wide enough that fifteen cards sit side by side without overlapping. Cards
 * grew when they gained real content, and at the old radius they collided —
 * neighbours bled through each other and the charts ran together into one band.
 */
const RADIUS = 5.2;

/**
 * How the orbit follows a hand, as opposed to a mouse.
 *
 * The soft idle spring carries about a second and a half of travel after its
 * target stops moving. Behind a mouse drag that lag is the point — the carousel
 * has weight and coasts. Behind a hand it is the whole complaint: the hand
 * stops and the orbit keeps spinning, so it reads as out of control rather than
 * as being steered.
 *
 * Stiff enough to arrive in about six tenths of a second, damped past
 * oscillation, so the carousel stands still very nearly when the hand does.
 *
 * It was stiffer still, and that stiffness sent the value to infinity the
 * moment the frame rate dropped — the carousel span too fast to see. The
 * integrator no longer permits that, and this is chosen for how it feels
 * rather than for what it can survive.
 */
const HAND_SPRING = { tension: 500, friction: 50 };

export function OrbitController() {
  const targetRotation = useOrbitStore((s) => s.rotation);
  const handTracking = useGestureStore((s) => s.status) === "active";
  const rotationDeg = useSpringNumber(targetRotation, handTracking ? HAND_SPRING : CardSprings.idle);
  const step = 360 / moduleRegistry.length;

  useEffect(() => {
    loadAllModuleData();

    // The Music card reads the live player and the saved collections, so it
    // has to be re-read when either moves. Without this the card kept the
    // numbers it had when the page opened and disagreed with its own panel.
    const stopPlay = usePlayStore.subscribe(refreshModuleData);
    const stopLists = usePlaylistStore.subscribe(refreshModuleData);
    return () => {
      stopPlay();
      stopLists();
    };
  }, []);

  return (
    <group>
      {moduleRegistry.map((mod, i) => {
        const angleDeg = i * step + rotationDeg;
        const rad = (angleDeg * Math.PI) / 180;
        const x = RADIUS * Math.sin(rad);
        const z = RADIUS * Math.cos(rad);
        const depthFactor = Math.cos(rad);
        return (
          <HolographicCard
            key={mod.id}
            module={mod}
            x={x}
            z={z}
            rotationY={rad}
            depthFactor={depthFactor}
          />
        );
      })}
    </group>
  );
}
