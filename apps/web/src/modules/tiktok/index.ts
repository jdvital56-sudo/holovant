import type { ModuleDefinition } from "@holovant/module-contracts";
import { createMockProvider } from "@/lib/createMockProvider";
import { compactNumber } from "@/lib/format";

export interface TiktokSnapshot {
  followers: number;
  weeklyGrowthPct: number;
  topVideoViews: number;
}

export const tiktokModule: ModuleDefinition<TiktokSnapshot> = {
  id: "tiktok",
  label: "TikTok",
  tagline: "Views & engagement",
  themeColor: "#8476fd",
  dataProvider: createMockProvider<TiktokSnapshot>({
    followers: 96500,
    weeklyGrowthPct: 4.1,
    topVideoViews: 812000,
  }),
  toMetrics: (d) => [
    { label: "Followers", value: compactNumber(d.followers), deltaPct: d.weeklyGrowthPct },
    { label: "Top video views", value: compactNumber(d.topVideoViews) },
    { label: "Weekly growth", value: `${d.weeklyGrowthPct.toFixed(1)}%` },
  ],
  toAdvice: (d, lang) => {
    const reachRatio = d.topVideoViews / Math.max(1, d.followers);
    const growing = d.weeklyGrowthPct >= 3;
    const stalling = d.weeklyGrowthPct < 1;
    const tips: string[] = [];

    if (lang === "ru") {
      if (reachRatio >= 3)
        tips.push(`Лучшее видео уходит далеко за пределы аудитории (×${reachRatio.toFixed(1)}) — повторите этот формат`);
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
      tips.push(`Top video travels well beyond the audience (${reachRatio.toFixed(1)}×) — repeat this format`);
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
