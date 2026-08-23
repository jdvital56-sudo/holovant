"use client";

import { useRef, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { OrbitController } from "@/scene/orbit/OrbitController";
import { useMouseKeyboardAdapter } from "@/gestures/adapters/useMouseKeyboardAdapter";
import { isWebglSupported } from "@/lib/webgl";
import { StaticFallbackScene } from "./StaticFallbackScene";
import { ParticleField } from "./ParticleField";
import { CameraRig } from "./CameraRig";

export function SceneRoot() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [webglOk, setWebglOk] = useState<boolean | null>(null);
  useMouseKeyboardAdapter(containerRef);

  useEffect(() => {
    // Deferred to after mount (not computed during render) so the server
    // and first client render agree — WebGL can only be probed client-side.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWebglOk(isWebglSupported());
  }, []);

  if (webglOk === false) return <StaticFallbackScene />;

  return (
    <div ref={containerRef} className="fixed inset-0 touch-none cursor-grab active:cursor-grabbing">
      {webglOk && (
        <Canvas camera={{ position: [0, 0.6, 8.5], fov: 45 }} dpr={[1, 2]}>
          <color attach="background" args={["#05070b"]} />
          <fog attach="fog" args={["#05070b", 6, 16]} />
          <ambientLight intensity={0.5} />
          <pointLight position={[0, 3, 4]} intensity={40} color="#6fb3ff" />
          <pointLight position={[-4, -2, -3]} intensity={15} color="#35547a" />
          <CameraRig />
          <ParticleField />
          <OrbitController />
          <EffectComposer>
            <Bloom luminanceThreshold={0.15} luminanceSmoothing={0.9} intensity={0.9} mipmapBlur />
          </EffectComposer>
        </Canvas>
      )}
    </div>
  );
}
