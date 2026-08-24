import type { ModuleAccount, ModuleDefinition } from "@holovant/module-contracts";
import {
  createMultiAccountProvider,
  sumBy,
  weightedAverage,
} from "@/lib/createMultiAccountProvider";
import { compactNumber } from "@/lib/format";

export interface LinkedinSnapshot {
  followers: number;
  weeklyGrowthPct: number;
  postEngagementPct: number;
}

const accounts: ModuleAccount<LinkedinSnapshot>[] = [
  { id: "personal", label: "Vadym", data: { followers: 5400, weeklyGrowthPct: 2.2, postEngagementPct: 6.4 } },
  { id: "company", label: "Holovant", data: { followers: 2100, weeklyGrowthPct: 4.8, postEngagementPct: 3.1 } },
];

export const linkedinModule: ModuleDefinition<LinkedinSnapshot> = {
  id: "linkedin",
  label: "LinkedIn",
  tagline: "Network growth",
  themeColor: "#6a83f5",
  dataProvider: createMultiAccountProvider<LinkedinSnapshot>({
    accounts,
    aggregate: (all) => ({
      // Audience adds up; a growth rate is weighted by audience so a
      // small fast-growing account cannot flatter the whole picture.
      followers: sumBy(all, (d) => d.followers),
      weeklyGrowthPct: weightedAverage(all, (d) => d.weeklyGrowthPct, (d) => d.followers),
      postEngagementPct: weightedAverage(all, (d) => d.postEngagementPct, (d) => d.followers),
    }),
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
