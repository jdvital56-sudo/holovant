import type { ModuleDefinition } from "@holovant/module-contracts";
import { createMockProvider } from "@/lib/createMockProvider";

export interface XSnapshot {
  followers: number;
  weeklyGrowthPct: number;
  topPostImpressions: number;
}

export const xModule: ModuleDefinition<XSnapshot> = {
  id: "x",
  label: "X",
  tagline: "Followers & impressions",
  themeColor: "#8b7bff",
  dataProvider: createMockProvider<XSnapshot>({
    followers: 12800,
    weeklyGrowthPct: 0.9,
    topPostImpressions: 58900,
  }),
};
