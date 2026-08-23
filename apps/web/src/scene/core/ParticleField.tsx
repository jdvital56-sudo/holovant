"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { qualityPresets, MAX_PARTICLES } from "@/quality/qualityPresets";
import { useQualityStore } from "@/quality/qualityStore";

const SPREAD = 14;

function generatePositions(): Float32Array {
  const arr = new Float32Array(MAX_PARTICLES * 3);
  for (let i = 0; i < MAX_PARTICLES; i++) {
    arr[i * 3] = (Math.random() - 0.5) * SPREAD;
    arr[i * 3 + 1] = (Math.random() - 0.5) * SPREAD * 0.6;
    arr[i * 3 + 2] = (Math.random() - 0.5) * SPREAD;
  }
  return arr;
}

// Generated once at module load, not per-render — the field never needs to
// reshuffle, so there's no reason to touch Math.random() during render.
const positions = generatePositions();

/** Slow-drifting ambient particles — the "the world should feel alive" layer. */
export function ParticleField() {
  const pointsRef = useRef<THREE.Points>(null);
  const tier = useQualityStore((s) => s.tier);
  const count = qualityPresets[tier].particleCount;

  useFrame((state) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.y = state.clock.elapsedTime * 0.006;
  });

  if (count === 0) return null;

  return (
    <points ref={pointsRef}>
      {/* The buffer is allocated once at the maximum budget; lowering quality
          narrows the draw range rather than reallocating geometry. */}
      <bufferGeometry drawRange={{ start: 0, count }}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.028}
        color="#6fb3ff"
        transparent
        opacity={0.45}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}
