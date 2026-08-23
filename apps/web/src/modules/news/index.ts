import type { ModuleDefinition } from "@holovant/module-contracts";
import { createMockProvider } from "@/lib/createMockProvider";

export interface NewsSnapshot {
  headline: string;
  unreadCount: number;
}

export const newsModule: ModuleDefinition<NewsSnapshot> = {
  id: "news",
  label: "News",
  tagline: "Today's briefing",
  themeColor: "#4fd1c5",
  dataProvider: createMockProvider<NewsSnapshot>({
    headline: "AI model releases accelerate again",
    unreadCount: 12,
  }),
};
