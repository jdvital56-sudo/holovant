"use client";

import { useRef, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useMouseKeyboardAdapter } from "@/gestures/adapters/useMouseKeyboardAdapter";
import { isWebglSupported } from "@/lib/webgl";
import { StaticFallbackScene } from "./StaticFallbackScene";
import { BootIndicator } from "./BootIndicator";

// Loaded only once WebGL is confirmed, which keeps the renderer out of the
// initial download entirely — including for devices that will never run it.
const HolographicScene = dynamic(
  () => import("./HolographicScene").then((m) => m.HolographicScene),
  { ssr: false, loading: () => <BootIndicator /> },
);

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
      {webglOk === null ? <BootIndicator /> : <HolographicScene />}
    </div>
  );
}
