"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitController } from "@/scene/orbit/OrbitController";
import { QualityGovernor } from "@/quality/QualityGovernor";
import { ParticleField } from "./ParticleField";
import { CameraRig } from "./CameraRig";
import { PostEffects } from "./PostEffects";

/**
 * Everything that touches Three.js lives behind this component, which is
 * loaded on demand — so a device that cannot run WebGL never downloads the
 * renderer just to be shown a fallback list.
 */
export function HolographicScene() {
  return (
    <Canvas camera={{ position: [0, 0.6, 10.6], fov: 45 }}>
      <color attach="background" args={["#05070b"]} />
      <fog attach="fog" args={["#05070b", 6, 16]} />
      <ambientLight intensity={0.5} />
      <pointLight position={[0, 3, 4]} intensity={40} color="#6fb3ff" />
      <pointLight position={[-4, -2, -3]} intensity={15} color="#35547a" />
      <QualityGovernor />
      <CameraRig />
      <ParticleField />
      <OrbitController />
      <PostEffects />
    </Canvas>
  );
}
