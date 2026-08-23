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
  themeColor: "#5b8cff",
  dataProvider: createMockProvider<SportsSnapshot>({
    liveFixture: "Arsenal vs Man City",
    score: "1 - 1",
  }),
};
