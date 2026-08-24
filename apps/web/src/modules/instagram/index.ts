import type { ModuleAccount, ModuleDefinition } from "@holovant/module-contracts";
import {
  createMultiAccountProvider,
  sumBy,
  maxBy,
  weightedAverage,
} from "@/lib/createMultiAccountProvider";
import { compactNumber } from "@/lib/format";

export interface InstagramSnapshot {
  followers: number;
  weeklyGrowthPct: number;
  topPostReach: number;
}

const accounts: ModuleAccount<InstagramSnapshot>[] = [
  { id: "main", label: "@holovant", data: { followers: 48200, weeklyGrowthPct: 2.4, topPostReach: 121000 } },
  { id: "studio", label: "@holovant.studio", data: { followers: 12400, weeklyGrowthPct: 5.8, topPostReach: 64300 } },
  { id: "personal", label: "@vadym", data: { followers: 3100, weeklyGrowthPct: 0.6, topPostReach: 4200 } },
];

export const instagramModule: ModuleDefinition<InstagramSnapshot> = {
  id: "instagram",
  label: "Instagram",
  tagline: "Followers & reach",
  themeColor: "#957aff",
  dataProvider: createMultiAccountProvider<InstagramSnapshot>({
    accounts,
    aggregate: (all) => ({
      // Followers add up; growth is a rate, so it is weighted by audience —
      // a tiny account growing fast must not flatter the whole picture. Best
      // reach is a single post, so it is the largest, never a total.
      followers: sumBy(all, (d) => d.followers),
      weeklyGrowthPct: weightedAverage(all, (d) => d.weeklyGrowthPct, (d) => d.followers),
      topPostReach: maxBy(all, (d) => d.topPostReach),
    }),
  }),
  toMetrics: (d) => [
    { label: "Followers", value: compactNumber(d.followers), deltaPct: d.weeklyGrowthPct },
    { label: "Top post reach", value: compactNumber(d.topPostReach) },
    { label: "Weekly growth", value: `${d.weeklyGrowthPct.toFixed(1)}%` },
  ],
  toAdvice: (d, lang) => {
    const reachRatio = d.topPostReach / Math.max(1, d.followers);
    const growing = d.weeklyGrowthPct >= 3;
    const stalling = d.weeklyGrowthPct < 1;
    const tips: string[] = [];

    if (lang === "ru") {
      if (reachRatio >= 3)
        tips.push(`Лучший пост уходит далеко за пределы аудитории (×${reachRatio.toFixed(1)}) — повторите этот формат`);
      else if (reachRatio >= 1.5)
        tips.push(`Охват выше аудитории (×${reachRatio.toFixed(1)}) — формат рабочий`);
      else tips.push(`Охват ниже аудитории (×${reachRatio.toFixed(1)}) — контент не выходит за своих`);

      if (growing) tips.push(`Рост ${d.weeklyGrowthPct.toFixed(1)}% в неделю — вкладывайтесь сюда`);
      else if (stalling)
        tips.push(`Рост ${d.weeklyGrowthPct.toFixed(1)}% — почти стоит, канал не окупает время`);
      else tips.push(`Рост ${d.weeklyGrowthPct.toFixed(1)}% — ровный, без рывков`);

      return { spoken: `${tips[0]}. ${tips[1]}`, tips };
    }

    if (reachRatio >= 3)
      tips.push(`Top post travels well beyond the audience (${reachRatio.toFixed(1)}×) — repeat this format`);
    else if (reachRatio >= 1.5)
      tips.push(`Reach exceeds audience (${reachRatio.toFixed(1)}×) — the format works`);
    else tips.push(`Reach is below audience size (${reachRatio.toFixed(1)}×) — content is not leaving the follower base`);

    if (growing) tips.push(`Growing ${d.weeklyGrowthPct.toFixed(1)}% a week — worth the investment`);
    else if (stalling)
      tips.push(`Growth ${d.weeklyGrowthPct.toFixed(1)}% — near flat, this channel is not paying for the time`);
    else tips.push(`Growth ${d.weeklyGrowthPct.toFixed(1)}% — steady`);

    return { spoken: `${tips[0]}. ${tips[1]}`, tips };
  },
};
