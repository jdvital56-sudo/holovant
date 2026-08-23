import type { ModuleDefinition } from "@holovant/module-contracts";
import { createMockProvider } from "@/lib/createMockProvider";

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
};
