import { create } from "zustand";
import { qualityPresets, type QualityPreset, type QualityTier } from "./qualityPresets";

interface QualityState {
  tier: QualityTier;
  /** Measured, not assumed — the HUD reports this number to the user. */
  fps: number;
  /** False once the governor has stepped down, so the HUD can say why. */
  autoAdjusted: boolean;
}

export const useQualityStore = create<QualityState>(() => ({
  tier: "high",
  fps: 0,
  autoAdjusted: false,
}));

export function setMeasuredFps(fps: number) {
  useQualityStore.setState({ fps });
}

export function setTier(tier: QualityTier) {
  useQualityStore.setState({ tier, autoAdjusted: tier !== "high" });
}

export function getPreset(): QualityPreset {
  return qualityPresets[useQualityStore.getState().tier];
}
