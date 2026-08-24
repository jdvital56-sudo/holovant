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
  themeColor: "#52d1d9",
  dataProvider: createMockProvider<NewsSnapshot>({
    headline: "AI model releases accelerate again",
    unreadCount: 12,
  }),
  toMetrics: (d) => [
    { label: "Top headline", value: d.headline },
    { label: "Unread", value: `${d.unreadCount}` },
  ],
  toAdvice: (d, lang) => {
    const piled = d.unreadCount >= 10;
    const tips =
      lang === "ru"
        ? [
            `Главное сейчас: ${d.headline}`,
            piled
              ? `${d.unreadCount} непрочитанных — читать всё не нужно, возьмите три верхних`
              : `${d.unreadCount} непрочитанных — разберётесь за пару минут`,
            "Скажите «найди» с темой, чтобы копнуть глубже",
          ]
        : [
            `Leading now: ${d.headline}`,
            piled
              ? `${d.unreadCount} unread — you do not need all of it, take the top three`
              : `${d.unreadCount} unread — a couple of minutes' work`,
            "Say “search for” with a topic to go deeper",
          ];
    return { spoken: `${tips[0]}. ${tips[1]}`, tips };
  },
};
