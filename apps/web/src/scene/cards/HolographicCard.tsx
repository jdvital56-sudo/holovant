"use client";

import { Html } from "@react-three/drei";
import { useOrbitStore, setHovered } from "@/stores/orbitStore";
import type { ModuleDefinition } from "@holovant/module-contracts";

interface HolographicCardProps {
  module: ModuleDefinition;
  x: number;
  z: number;
  rotationY: number;
  depthFactor: number; // 1 = front, -1 = back
}

export function HolographicCard({ module, x, z, rotationY, depthFactor }: HolographicCardProps) {
  const state = useOrbitStore((s) => s.cardState(module.id));
  const dispatch = useOrbitStore((s) => s.dispatch);

  const opacity = 0.32 + 0.68 * ((depthFactor + 1) / 2);
  const isSelected = state === "selected" || state === "expanded";
  const isHovered = state === "hovered";

  return (
    <group position={[x, 0, z]} rotation={[0, rotationY, 0]}>
      <Html
        transform
        occlude={false}
        distanceFactor={4}
        style={{ pointerEvents: "auto" }}
      >
        <div
          onClick={() => dispatch({ type: "select", cardId: module.id, source: "mouse" })}
          onPointerEnter={() => setHovered(module.id)}
          onPointerLeave={() => setHovered(null)}
          className={[
            "relative w-[190px] h-[130px] rounded-2xl px-4 py-3 cursor-pointer select-none",
            "flex flex-col justify-between font-display",
            "bg-[rgba(16,24,38,0.5)] backdrop-blur-md",
            "border transition-[border-color,box-shadow,transform] duration-300",
            isSelected
              ? "border-signal/70 shadow-[0_10px_40px_rgba(0,0,0,0.55),0_0_50px_rgba(111,179,255,0.28)] scale-105"
              : isHovered
                ? "border-signal/50 shadow-[0_8px_30px_rgba(0,0,0,0.5),0_0_28px_rgba(111,179,255,0.16)]"
                : "border-[rgba(143,178,222,0.16)] shadow-[0_8px_30px_rgba(0,0,0,0.45)]",
          ].join(" ")}
          style={{ opacity }}
        >
          {isSelected && (
            <>
              <span className="absolute -top-2 -left-2 w-3.5 h-3.5 border-l-[1.5px] border-t-[1.5px] border-signal" />
              <span className="absolute -top-2 -right-2 w-3.5 h-3.5 border-r-[1.5px] border-t-[1.5px] border-signal" />
              <span className="absolute -bottom-2 -left-2 w-3.5 h-3.5 border-l-[1.5px] border-b-[1.5px] border-signal" />
              <span className="absolute -bottom-2 -right-2 w-3.5 h-3.5 border-r-[1.5px] border-b-[1.5px] border-signal" />
            </>
          )}
          <div className="font-mono text-[10px] tracking-wider text-signal/85">
            {module.label.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-semibold text-frost">{module.label}</div>
            <div className="font-mono text-[10px] text-mist">{module.tagline}</div>
          </div>
        </div>
      </Html>
    </group>
  );
}
