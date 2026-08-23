export type QualityTier = "high" | "medium" | "low" | "minimal";

export interface QualityPreset {
  bloomEnabled: boolean;
  bloomIntensity: number;
  particleCount: number;
  pixelRatioCap: number;
}

/** Ordered cheapest-last, so stepping down a tier is an index step. */
export const TIER_ORDER: QualityTier[] = ["high", "medium", "low", "minimal"];

/**
 * Single source of truth for adaptive degradation. The particle field, the
 * bloom pass, and the renderer's pixel ratio all read from here — nothing
 * hardcodes effect intensity elsewhere.
 */
export const qualityPresets: Record<QualityTier, QualityPreset> = {
  high: { bloomEnabled: true, bloomIntensity: 0.9, particleCount: 1400, pixelRatioCap: 2 },
  medium: { bloomEnabled: true, bloomIntensity: 0.75, particleCount: 800, pixelRatioCap: 1.5 },
  low: { bloomEnabled: true, bloomIntensity: 0.6, particleCount: 350, pixelRatioCap: 1 },
  minimal: { bloomEnabled: false, bloomIntensity: 0, particleCount: 0, pixelRatioCap: 1 },
};

/** Largest particle budget any tier can ask for — the buffer is sized once to this. */
export const MAX_PARTICLES = Math.max(...TIER_ORDER.map((t) => qualityPresets[t].particleCount));
