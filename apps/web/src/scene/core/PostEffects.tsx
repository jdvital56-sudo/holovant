"use client";

import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { qualityPresets } from "@/quality/qualityPresets";
import { useQualityStore } from "@/quality/qualityStore";

/**
 * Bloom is what makes the card edges and particles read as emitted light
 * rather than painted colour — so it is the last thing dropped, and the
 * lower tiers dim it before the minimal tier removes the pass entirely.
 */
export function PostEffects() {
  const tier = useQualityStore((s) => s.tier);
  const preset = qualityPresets[tier];

  if (!preset.bloomEnabled) return null;

  return (
    <EffectComposer>
      <Bloom
        luminanceThreshold={0.15}
        luminanceSmoothing={0.9}
        intensity={preset.bloomIntensity}
        mipmapBlur
      />
    </EffectComposer>
  );
}
