import type { ModuleDefinition } from "@holovant/module-contracts";
import { createMockProvider } from "@/lib/createMockProvider";
import { compactNumber } from "@/lib/format";

export interface XSnapshot {
  followers: number;
  weeklyGrowthPct: number;
  topPostImpressions: number;
}

export const xModule: ModuleDefinition<XSnapshot> = {
  id: "x",
  label: "X",
  tagline: "Followers & impressions",
  themeColor: "#6e79f8",
  dataProvider: createMockProvider<XSnapshot>({
    followers: 12800,
    weeklyGrowthPct: 0.9,
    topPostImpressions: 58900,
  }),
  toMetrics: (d) => [
    { label: "Followers", value: compactNumber(d.followers), deltaPct: d.weeklyGrowthPct },
    { label: "Top post impressions", value: compactNumber(d.topPostImpressions) },
    { label: "Weekly growth", value: `${d.weeklyGrowthPct.toFixed(1)}%` },
  ],
};
