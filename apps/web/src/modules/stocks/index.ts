import type { ModuleDefinition } from "@holovant/module-contracts";
import { createMockProvider } from "@/lib/createMockProvider";

export interface StocksSnapshot {
  portfolioValue: number;
  dayChangePct: number;
  topHolding: string;
}

export const stocksModule: ModuleDefinition<StocksSnapshot> = {
  id: "stocks",
  label: "Stocks",
  tagline: "Portfolio performance",
  themeColor: "#4fd1c5",
  dataProvider: createMockProvider<StocksSnapshot>({
    portfolioValue: 182450,
    dayChangePct: 1.1,
    topHolding: "NVDA",
  }),
};
