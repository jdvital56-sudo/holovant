import type { ModuleDefinition } from "@holovant/module-contracts";
import { createMockProvider } from "@/lib/createMockProvider";
import { currency } from "@/lib/format";

export interface StocksSnapshot {
  portfolioValue: number;
  dayChangePct: number;
  topHolding: string;
}

export const stocksModule: ModuleDefinition<StocksSnapshot> = {
  id: "stocks",
  label: "Stocks",
  tagline: "Portfolio performance",
  themeColor: "#6397f0",
  dataProvider: createMockProvider<StocksSnapshot>({
    portfolioValue: 182450,
    dayChangePct: 1.1,
    topHolding: "NVDA",
  }),
  toMetrics: (d) => [
    { label: "Portfolio value", value: currency(d.portfolioValue), deltaPct: d.dayChangePct },
    { label: "Day change", value: `${d.dayChangePct.toFixed(1)}%` },
    { label: "Top holding", value: d.topHolding },
  ],
  toAdvice: (d, lang) => {
    const up = d.dayChangePct >= 0;
    const big = Math.abs(d.dayChangePct) >= 2;
    const tips =
      lang === "ru"
        ? [
            `Портфель ${d.portfolioValue.toLocaleString("ru-RU")} $, за день ${up ? "+" : ""}${d.dayChangePct.toFixed(1)}%`,
            big
              ? "Движение крупное — посмотрите, что его вызвало, прежде чем реагировать"
              : "Движение в пределах обычного дня — действий не требует",
            `Крупнейшая позиция ${d.topHolding} — проверьте, не перевешивает ли она портфель`,
          ]
        : [
            `Portfolio $${d.portfolioValue.toLocaleString("en-US")}, ${up ? "+" : ""}${d.dayChangePct.toFixed(1)}% today`,
            big
              ? "That is a large move — find out what caused it before reacting"
              : "Within a normal day's range — no action needed",
            `Largest holding is ${d.topHolding} — check it is not overweighting the portfolio`,
          ];
    return { spoken: `${tips[0]}. ${tips[1]}`, tips };
  },
};
