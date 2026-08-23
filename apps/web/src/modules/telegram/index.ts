import type { ModuleDefinition } from "@holovant/module-contracts";
import { createMockProvider } from "@/lib/createMockProvider";

export interface TelegramSnapshot {
  subscribers: number;
  weeklyGrowthPct: number;
  postViews: number;
}

export const telegramModule: ModuleDefinition<TelegramSnapshot> = {
  id: "telegram",
  label: "Telegram",
  tagline: "Channel growth",
  themeColor: "#4fd1c5",
  dataProvider: createMockProvider<TelegramSnapshot>({
    subscribers: 8100,
    weeklyGrowthPct: 3.5,
    postViews: 15200,
  }),
};
