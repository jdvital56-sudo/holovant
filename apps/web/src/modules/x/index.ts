import type { ModuleAccount, ModuleDefinition } from "@holovant/module-contracts";
import {
  createMultiAccountProvider,
  sumBy,
  maxBy,
  weightedAverage,
} from "@/lib/createMultiAccountProvider";
import { compactNumber } from "@/lib/format";

export interface XSnapshot {
  followers: number;
  weeklyGrowthPct: number;
  topPostImpressions: number;
}

const accounts: ModuleAccount<XSnapshot>[] = [
  { id: "main", label: "@holovant", data: { followers: 12800, weeklyGrowthPct: 0.9, topPostImpressions: 58900 } },
  { id: "build", label: "@buildinpublic", data: { followers: 4600, weeklyGrowthPct: 3.7, topPostImpressions: 92000 } },
];

export const xModule: ModuleDefinition<XSnapshot> = {
  id: "x",
  label: "X",
  tagline: "Followers & impressions",
  themeColor: "#6e79f8",
  dataProvider: createMultiAccountProvider<XSnapshot>({
    accounts,
    aggregate: (all) => ({
      // Audience adds up; a growth rate is weighted by audience so a
      // small fast-growing account cannot flatter the whole picture.
      followers: sumBy(all, (d) => d.followers),
      weeklyGrowthPct: weightedAverage(all, (d) => d.weeklyGrowthPct, (d) => d.followers),
      topPostImpressions: maxBy(all, (d) => d.topPostImpressions),
    }),
  }),
  toMetrics: (d) => [
    { label: "Followers", value: compactNumber(d.followers), deltaPct: d.weeklyGrowthPct },
    { label: "Top post impressions", value: compactNumber(d.topPostImpressions) },
    { label: "Weekly growth", value: `${d.weeklyGrowthPct.toFixed(1)}%` },
  ],
  toAdvice: (d, lang) => {
    const reachRatio = d.topPostImpressions / Math.max(1, d.followers);
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
