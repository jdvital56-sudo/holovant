import type { ModuleDefinition } from "@holovant/module-contracts";
import { createMockProvider } from "@/lib/createMockProvider";
import { compactNumber } from "@/lib/format";

export interface TiktokSnapshot {
  followers: number;
  weeklyGrowthPct: number;
  topVideoViews: number;
}

export const tiktokModule: ModuleDefinition<TiktokSnapshot> = {
  id: "tiktok",
  label: "TikTok",
  tagline: "Views & engagement",
  themeColor: "#5b8cff",
  dataProvider: createMockProvider<TiktokSnapshot>({
    followers: 96500,
    weeklyGrowthPct: 4.1,
    topVideoViews: 812000,
  }),
  toMetrics: (d) => [
    { label: "Followers", value: compactNumber(d.followers), deltaPct: d.weeklyGrowthPct },
    { label: "Top video views", value: compactNumber(d.topVideoViews) },
    { label: "Weekly growth", value: `${d.weeklyGrowthPct.toFixed(1)}%` },
  ],
};
