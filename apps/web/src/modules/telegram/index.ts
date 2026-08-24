import type { ModuleAccount, ModuleDefinition } from "@holovant/module-contracts";
import {
  createMultiAccountProvider,
  sumBy,
  maxBy,
  weightedAverage,
} from "@/lib/createMultiAccountProvider";
import { compactNumber } from "@/lib/format";

export interface TelegramSnapshot {
  subscribers: number;
  weeklyGrowthPct: number;
  postViews: number;
}

const accounts: ModuleAccount<TelegramSnapshot>[] = [
  { id: "main", label: "Holovant", data: { subscribers: 8100, weeklyGrowthPct: 3.5, postViews: 15200 } },
  { id: "dev", label: "Holovant Dev", data: { subscribers: 1900, weeklyGrowthPct: 7.1, postViews: 5400 } },
];

export const telegramModule: ModuleDefinition<TelegramSnapshot> = {
  id: "telegram",
  label: "Telegram",
  tagline: "Channel growth",
  themeColor: "#668df3",
  dataProvider: createMultiAccountProvider<TelegramSnapshot>({
    accounts,
    aggregate: (all) => ({
      // Audience adds up; a growth rate is weighted by audience so a
      // small fast-growing account cannot flatter the whole picture.
      subscribers: sumBy(all, (d) => d.subscribers),
      weeklyGrowthPct: weightedAverage(all, (d) => d.weeklyGrowthPct, (d) => d.subscribers),
      postViews: maxBy(all, (d) => d.postViews),
    }),
  }),
  toMetrics: (d) => [
    { label: "Subscribers", value: compactNumber(d.subscribers), deltaPct: d.weeklyGrowthPct },
    { label: "Avg post views", value: compactNumber(d.postViews) },
    { label: "Weekly growth", value: `${d.weeklyGrowthPct.toFixed(1)}%` },
  ],
  toAdvice: (d, lang) => {
    const reachRatio = d.postViews / Math.max(1, d.subscribers);
    const growing = d.weeklyGrowthPct >= 3;
    const stalling = d.weeklyGrowthPct < 1;
    const tips: string[] = [];

    if (lang === "ru") {
      if (reachRatio >= 3)
        tips.push(`Просмотры постов уходит далеко за пределы аудитории (×${reachRatio.toFixed(1)}) — повторите этот формат`);
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
      tips.push(`Post views travels well beyond the audience (${reachRatio.toFixed(1)}×) — repeat this format`);
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
