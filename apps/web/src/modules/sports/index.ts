import type { ModuleDefinition } from "@holovant/module-contracts";
import { createMockProvider } from "@/lib/createMockProvider";

export interface SportsSnapshot {
  liveFixture: string;
  score: string;
}

export const sportsModule: ModuleDefinition<SportsSnapshot> = {
  id: "sports",
  label: "Sports",
  tagline: "Live scores",
  themeColor: "#5cabe9",
  dataProvider: createMockProvider<SportsSnapshot>({
    liveFixture: "Arsenal vs Man City",
    score: "1 - 1",
  }),
  toMetrics: (d) => [
    { label: "Live fixture", value: d.liveFixture },
    { label: "Score", value: d.score },
  ],
};
