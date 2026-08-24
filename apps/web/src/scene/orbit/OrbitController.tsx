"use client";

import { useEffect } from "react";
import { moduleRegistry } from "@/modules/registry";
import { loadAllModuleData } from "@/modules/moduleDataStore";
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

export function OrbitController() {
  const targetRotation = useOrbitStore((s) => s.rotation);
  const rotationDeg = useSpringNumber(targetRotation, CardSprings.idle);
  const step = 360 / moduleRegistry.length;

  useEffect(() => {
    loadAllModuleData();
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
