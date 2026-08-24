"use client";

import { Html } from "@react-three/drei";
import { useOrbitStore, setHovered } from "@/stores/orbitStore";
import { useCardStyleStore } from "@/stores/cardStyleStore";
import { useModuleMetrics, useModuleAccountCount } from "@/modules/moduleDataStore";
import type { ModuleDefinition } from "@holovant/module-contracts";
import { InstrumentFace, GlyphFace, ReadoutFace } from "./CardFaces";
import { HoloFace } from "./HoloFace";

interface HolographicCardProps {
  module: ModuleDefinition;
  x: number;
  z: number;
  rotationY: number;
  depthFactor: number; // 1 = front, -1 = back
}

/**
 * Past this the card has turned edge-on and is about to show its reverse,
 * where the DOM face reads mirrored. It fades out before that can be seen.
 */
const FACING_CUTOFF = 0.06;

export function HolographicCard({ module, x, z, rotationY, depthFactor }: HolographicCardProps) {
  const state = useOrbitStore((s) => s.cardState(module.id));
  const dispatch = useOrbitStore((s) => s.dispatch);
  const style = useCardStyleStore((s) => s.style);
  const metrics = useModuleMetrics(module.id);
  const accountCount = useModuleAccountCount(module.id);

  const isSelected = state === "selected" || state === "expanded";
  const isHovered = state === "hovered";
  /** Front-facing cards open on click; the rest first travel to the front, so
   * clicking to steer the carousel never fires a panel the user didn't ask for. */
  const isFrontmost = depthFactor > 0.85;
  const accent = module.themeColor;

  // Cards on the far arc are turned away from the camera, so their text would
  // render backwards. They fade out as they turn rather than being seen reversed.
  if (depthFactor < FACING_CUTOFF) return null;
  const facing = (depthFactor - FACING_CUTOFF) / (1 - FACING_CUTOFF);

  /**
   * Only the card at the centre is meant to be read. Raising `facing` to a
   * power makes the falloff steep, so its neighbours recede into context
   * instead of competing for attention at nearly the same brightness.
   */
  const focus = Math.pow(facing, 3);
  const opacity = 0.1 + 0.9 * focus;
  const dim = 0.45 + 0.55 * focus;

  const isHolo = style === "holo";
  const Face = isHolo
    ? HoloFace
    : style === "glyph"
      ? GlyphFace
      : style === "readout"
        ? ReadoutFace
        : InstrumentFace;

  return (
    <group position={[x, 0, z]} rotation={[0, rotationY, 0]}>
      {/* The DOM face is authored large and scaled down in the scene: rendering
          at more pixels than it occupies is what keeps the text crisp rather
          than resampled soft. */}
      <Html transform occlude={false} distanceFactor={2.6} style={{ pointerEvents: "auto" }}>
        <div
          onClick={() =>
            dispatch({ type: isFrontmost ? "expand" : "select", cardId: module.id, source: "mouse" })
          }
          onPointerEnter={() => setHovered(module.id)}
          onPointerLeave={() => setHovered(null)}
          className={[
            "relative h-[420px] w-[330px] cursor-pointer select-none rounded-[26px] px-6 py-5",
            "font-display",
            isHolo ? "backdrop-blur-[2px]" : "backdrop-blur-md",
            "border transition-[border-color,box-shadow,transform] duration-300",
            isSelected ? "scale-105" : "",
          ].join(" ")}
          style={{
            opacity,
            // Desaturating and darkening the off-centre cards, on top of fading
            // them, is what stops the ring reading as fifteen equal demands.
            filter: `saturate(${dim}) brightness(${0.55 + 0.45 * focus})`,
            // The hologram is meant to read as projected light, so its body
            // stays close to transparent and the ring supplies the brightness.
            background: isHolo
              ? `linear-gradient(160deg, ${accent}14 0%, rgba(8,14,24,0.34) 55%, ${accent}0f 100%)`
              : "linear-gradient(160deg, rgba(28,40,60,0.62) 0%, rgba(12,18,30,0.72) 55%, rgba(10,14,24,0.78) 100%)",
            borderColor: isSelected
              ? `${accent}b3`
              : isHovered
                ? `${accent}80`
                : "rgba(143,178,222,0.22)",
            boxShadow: isSelected
              ? `0 18px 60px rgba(0,0,0,0.6), 0 0 70px ${accent}59`
              : isHovered
                ? `0 14px 44px rgba(0,0,0,0.55), 0 0 46px ${accent}3d`
                : `0 12px 36px rgba(0,0,0,0.5), 0 0 26px ${accent}1a`,
          }}
        >
          {isSelected && (
            <>
              <span className="absolute -left-2 -top-2 h-4 w-4 border-l-2 border-t-2" style={{ borderColor: accent }} />
              <span className="absolute -right-2 -top-2 h-4 w-4 border-r-2 border-t-2" style={{ borderColor: accent }} />
              <span className="absolute -bottom-2 -left-2 h-4 w-4 border-b-2 border-l-2" style={{ borderColor: accent }} />
              <span className="absolute -bottom-2 -right-2 h-4 w-4 border-b-2 border-r-2" style={{ borderColor: accent }} />
            </>
          )}
          <Face module={module} metrics={metrics} accent={accent} accountCount={accountCount} />
        </div>
      </Html>
    </group>
  );
}
