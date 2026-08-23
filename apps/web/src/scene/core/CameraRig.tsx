"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";

/** Very subtle idle drift so the camera feels like it's floating, not locked to a tripod. */
export function CameraRig() {
  const { camera } = useThree();
  const base = useRef({ x: camera.position.x, y: camera.position.y, z: camera.position.z });

  // Imperative mutation of the R3F-managed camera inside useFrame is the
  // standard, documented way to drive per-frame motion without triggering
  // React re-renders every frame.
  /* eslint-disable react-hooks/immutability */
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    camera.position.x = base.current.x + Math.sin(t * 0.15) * 0.18;
    camera.position.y = base.current.y + Math.sin(t * 0.11) * 0.1;
    camera.lookAt(0, 0, 0);
  });
  /* eslint-enable react-hooks/immutability */

  return null;
}
