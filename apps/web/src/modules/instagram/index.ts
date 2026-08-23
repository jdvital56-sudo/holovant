import type { ModuleDefinition } from "@holovant/module-contracts";
import { createMockProvider } from "@/lib/createMockProvider";

export interface InstagramSnapshot {
  followers: number;
  weeklyGrowthPct: number;
  topPostReach: number;
}

export const instagramModule: ModuleDefinition<InstagramSnapshot> = {
  id: "instagram",
  label: "Instagram",
  tagline: "Followers & reach",
  themeColor: "#5b8cff",
  dataProvider: createMockProvider<InstagramSnapshot>({
    followers: 48200,
    weeklyGrowthPct: 2.4,
    topPostReach: 121000,
  }),
};
