import type { ModuleDefinition } from "@holovant/module-contracts";
import type { CardsRates } from "@/app/api/cards/route";
import { createCardProvider } from "@/lib/createCardProvider";
import { formatRate } from "@/server/rates";

/**
 * The rates he watches: the lira against the dollar and the euro, the hryvnia,
 * the euro against the dollar, gold and bitcoin.
 *
 * The card used to show a portfolio of $182,450 that belonged to nobody. It is
 * called Rates now because that is what it is — naming it Stocks was its own
 * small untruth, and this codebase's rule is that the interface may not promise
 * what the product does not do.
 */
export type StocksSnapshot = CardsRates;

export const stocksModule: ModuleDefinition<StocksSnapshot> = {
  id: "stocks",
  label: "Rates",
  tagline: "Currencies, gold, bitcoin",
  themeColor: "#63c8a0",
  dataProvider: createCardProvider<StocksSnapshot>("rates", { state: "unreachable", rows: [] }),
  toMetrics: (d) => {
    if (d.state !== "ok" || d.rows.length === 0) {
      return [
        { label: "Курсы", value: "не удалось получить" },
        { label: "Источник", value: "не ответил" },
      ];
    }
    // Every row, including the ones that came back empty: a rate he expects to
    // see and cannot find is worse than one showing a dash.
    return d.rows.map((row) => ({
      label: `${row.label} · ${row.unit}`,
      value: formatRate(row),
    }));
  },
  toAdvice: (d, lang) => {
    if (d.state !== "ok" || d.rows.length === 0) {
      const tips =
        lang === "ru"
          ? ["Курсы получить не удалось", "Источник не ответил — попробуйте позже"]
          : ["Rates could not be fetched", "The source did not answer — try again shortly"];
      return { spoken: tips[0], tips };
    }

    const say = (id: string) => {
      const row = d.rows.find((r) => r.id === id);
      return row ? `${formatRate(row)} ${row.unit}` : "—";
    };
    const missing = d.rows.filter((row) => row.value === null);

    const tips =
      lang === "ru"
        ? [
            `Доллар ${say("usd-try")}, евро ${say("eur-try")}`,
            `Гривна за доллар ${say("usd-uah")}, евро к доллару ${say("eur-usd")}`,
            `Золото ${say("gold")}, биткоин ${say("btc")}`,
            missing.length ? `Не получено: ${missing.map((r) => r.label).join(", ")}` : "",
          ].filter(Boolean)
        : [
            `Dollar ${say("usd-try")}, euro ${say("eur-try")}`,
            `Hryvnia per dollar ${say("usd-uah")}, euro to dollar ${say("eur-usd")}`,
            `Gold ${say("gold")}, bitcoin ${say("btc")}`,
            missing.length ? `Missing: ${missing.map((r) => r.label).join(", ")}` : "",
          ].filter(Boolean);
    return { spoken: tips[0], tips };
  },
};
