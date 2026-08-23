export type QualityTier = "high" | "medium" | "low" | "minimal";

export interface QualityPreset {
  bloomEnabled: boolean;
  dofEnabled: boolean;
  particleCount: number;
  pixelRatioCap: number;
  shadowsEnabled: boolean;
}

/**
 * Single source of truth for adaptive degradation. Postprocessing, the
 * particle field, and the renderer's pixel ratio all read from here —
 * nothing hardcodes effect intensity elsewhere.
 */
export const qualityPresets: Record<QualityTier, QualityPreset> = {
  high: { bloomEnabled: true, dofEnabled: true, particleCount: 2000, pixelRatioCap: 2, shadowsEnabled: true },
  medium: { bloomEnabled: true, dofEnabled: false, particleCount: 1000, pixelRatioCap: 1.5, shadowsEnabled: false },
  low: { bloomEnabled: true, dofEnabled: false, particleCount: 400, pixelRatioCap: 1, shadowsEnabled: false },
  minimal: { bloomEnabled: false, dofEnabled: false, particleCount: 0, pixelRatioCap: 1, shadowsEnabled: false },
};
