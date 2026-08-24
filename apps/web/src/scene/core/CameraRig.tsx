"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGestureStore } from "@/stores/gestureStore";

/** Seconds for drift to fully stop or resume — abrupt either way reads as a glitch. */
const SETTLE_SECONDS = 0.9;

/** Very subtle idle drift so the camera feels like it's floating, not locked to a tripod. */
export function CameraRig() {
  const { camera } = useThree();
  const base = useRef({ x: camera.position.x, y: camera.position.y, z: camera.position.z });
  const locked = useGestureStore((s) => s.locked);

  /**
   * Drift is scaled by a 0..1 multiplier rather than switched off, so locking
   * settles the camera over about a second instead of stopping it dead
   * mid-movement. At rest the offsets are exactly zero, not merely small.
   */
  const amplitude = useRef(1);

  // Imperative mutation of the R3F-managed camera inside useFrame is the
  // standard, documented way to drive per-frame motion without triggering
  // React re-renders every frame.
  /* eslint-disable react-hooks/immutability */
  useFrame((state, delta) => {
    const target = locked ? 0 : 1;
    const step = Math.min(delta / SETTLE_SECONDS, 1);
    amplitude.current += (target - amplitude.current) * step;
    if (Math.abs(amplitude.current - target) < 0.001) amplitude.current = target;

    const t = state.clock.elapsedTime;
    const a = amplitude.current;
    camera.position.x = base.current.x + Math.sin(t * 0.15) * 0.18 * a;
    camera.position.y = base.current.y + Math.sin(t * 0.11) * 0.1 * a;
    camera.lookAt(0, 0, 0);
  });
  /* eslint-enable react-hooks/immutability */

  return null;
}
