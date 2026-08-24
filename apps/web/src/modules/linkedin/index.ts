import type { ModuleDefinition } from "@holovant/module-contracts";
import { createMockProvider } from "@/lib/createMockProvider";
import { compactNumber } from "@/lib/format";

export interface LinkedinSnapshot {
  followers: number;
  weeklyGrowthPct: number;
  postEngagementPct: number;
}

export const linkedinModule: ModuleDefinition<LinkedinSnapshot> = {
  id: "linkedin",
  label: "LinkedIn",
  tagline: "Network growth",
  themeColor: "#6a83f5",
  dataProvider: createMockProvider<LinkedinSnapshot>({
    followers: 5400,
    weeklyGrowthPct: 2.2,
    postEngagementPct: 6.4,
  }),
  toMetrics: (d) => [
    { label: "Followers", value: compactNumber(d.followers), deltaPct: d.weeklyGrowthPct },
    { label: "Post engagement", value: `${d.postEngagementPct.toFixed(1)}%` },
    { label: "Weekly growth", value: `${d.weeklyGrowthPct.toFixed(1)}%` },
  ],
  toAdvice: (d, lang) => {
    const strong = d.postEngagementPct >= 5;
    const tips =
      lang === "ru"
        ? [
            strong
              ? `Вовлечённость ${d.postEngagementPct.toFixed(1)}% — заметно выше обычного для LinkedIn, аудитория тёплая`
              : `Вовлечённость ${d.postEngagementPct.toFixed(1)}% — низковато, посты не цепляют`,
            `${d.followers.toLocaleString("ru-RU")} подписчиков, рост ${d.weeklyGrowthPct.toFixed(1)}% в неделю`,
            strong ? "Хороший момент для поста о продукте" : "Попробуйте личный опыт вместо анонсов",
          ]
        : [
            strong
              ? `Engagement ${d.postEngagementPct.toFixed(1)}% — well above typical for LinkedIn, the audience is warm`
              : `Engagement ${d.postEngagementPct.toFixed(1)}% — low, posts are not landing`,
            `${d.followers.toLocaleString("en-US")} followers, growing ${d.weeklyGrowthPct.toFixed(1)}% a week`,
            strong ? "A good moment to post about the product" : "Try personal experience instead of announcements",
          ];
    return { spoken: tips[0], tips };
  },
};
