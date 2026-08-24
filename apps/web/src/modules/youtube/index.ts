import type { ModuleDefinition } from "@holovant/module-contracts";
import { createMockProvider } from "@/lib/createMockProvider";
import { compactNumber } from "@/lib/format";

export interface YoutubeSnapshot {
  subscribers: number;
  weeklyGrowthPct: number;
  latestVideoViews: number;
}

export const youtubeModule: ModuleDefinition<YoutubeSnapshot> = {
  id: "youtube",
  label: "YouTube",
  tagline: "Subscribers & views",
  themeColor: "#7372fb",
  dataProvider: createMockProvider<YoutubeSnapshot>({
    subscribers: 34200,
    weeklyGrowthPct: 1.8,
    latestVideoViews: 45300,
  }),
  toMetrics: (d) => [
    { label: "Subscribers", value: compactNumber(d.subscribers), deltaPct: d.weeklyGrowthPct },
    { label: "Latest video views", value: compactNumber(d.latestVideoViews) },
    { label: "Weekly growth", value: `${d.weeklyGrowthPct.toFixed(1)}%` },
  ],
};
