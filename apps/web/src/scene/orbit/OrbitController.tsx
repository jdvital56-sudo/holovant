"use client";

import { moduleRegistry } from "@/modules/registry";
import { useOrbitStore } from "@/stores/orbitStore";
import { useSpringNumber } from "@/motion/useSpringNumber";
import { CardSprings } from "@holovant/motion-vocabulary";
import { HolographicCard } from "../cards/HolographicCard";

const RADIUS = 3.4;

export function OrbitController() {
  const targetRotation = useOrbitStore((s) => s.rotation);
  const rotationDeg = useSpringNumber(targetRotation, CardSprings.idle);
  const step = 360 / moduleRegistry.length;

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
