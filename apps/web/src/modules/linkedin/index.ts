import type { ModuleDefinition } from "@holovant/module-contracts";
import { createMockProvider } from "@/lib/createMockProvider";
import { compactNumber } from "@/lib/format";

export interface LinkedinSnapshot {
  followers: number;
  weeklyGrowthPct: number;
  postEngagementPct: number;
}

export const linkedinModule: ModuleDefinition<LinkedinSnapshot> = {
  id: "linkedin",
  label: "LinkedIn",
  tagline: "Network growth",
  themeColor: "#5b8cff",
  dataProvider: createMockProvider<LinkedinSnapshot>({
    followers: 5400,
    weeklyGrowthPct: 2.2,
    postEngagementPct: 6.4,
  }),
  toMetrics: (d) => [
    { label: "Followers", value: compactNumber(d.followers), deltaPct: d.weeklyGrowthPct },
    { label: "Post engagement", value: `${d.postEngagementPct.toFixed(1)}%` },
    { label: "Weekly growth", value: `${d.weeklyGrowthPct.toFixed(1)}%` },
  ],
};
