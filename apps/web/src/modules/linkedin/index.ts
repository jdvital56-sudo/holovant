import type { ModuleDefinition } from "@holovant/module-contracts";
import { createMockProvider } from "@/lib/createMockProvider";

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
};
