import type { ModuleDefinition } from "@holovant/module-contracts";
import { createMockProvider } from "@/lib/createMockProvider";

export interface YoutubeSnapshot {
  subscribers: number;
  weeklyGrowthPct: number;
  latestVideoViews: number;
}

export const youtubeModule: ModuleDefinition<YoutubeSnapshot> = {
  id: "youtube",
  label: "YouTube",
  tagline: "Subscribers & views",
  themeColor: "#4fd1c5",
  dataProvider: createMockProvider<YoutubeSnapshot>({
    subscribers: 34200,
    weeklyGrowthPct: 1.8,
    latestVideoViews: 45300,
  }),
};
