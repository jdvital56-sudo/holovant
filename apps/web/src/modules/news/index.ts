import type { ModuleDataProvider, ModuleDefinition } from "@holovant/module-contracts";
import type { NewsReport } from "@/app/api/news/route";

/**
 * News on the subjects he follows, which he names out loud.
 *
 * The card used to lead with "AI model releases accelerate again" and twelve
 * unread, to everyone, forever. It has its own fetch rather than joining the
 * shared card report because it is the one that costs a search per miss.
 *
 * Empty rather than generic when he has said nothing: a card filled with
 * whatever the internet is loudest about is the same invention as the headline
 * it used to ship with, only harder to notice.
 */
export type NewsSnapshot = NewsReport;

const UNKNOWN = "—";
const CACHE_MS = 10 * 60_000;

let cached: { at: number; report: NewsReport } | null = null;

const newsProvider: ModuleDataProvider<NewsSnapshot> = {
  async getSnapshot(): Promise<NewsSnapshot> {
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.report;
    try {
      const response = await fetch("/api/news", { signal: AbortSignal.timeout(15000) });
      if (!response.ok) return { state: "unreachable", topics: null, items: [] };
      const report = (await response.json()) as NewsReport;
      cached = { at: Date.now(), report };
      return report;
    } catch {
      return { state: "unreachable", topics: null, items: [] };
    }
  },
};

export const newsModule: ModuleDefinition<NewsSnapshot> = {
  id: "news",
  label: "News",
  tagline: "Today's briefing",
  themeColor: "#52d1d9",
  dataProvider: newsProvider,
  toMetrics: (d) => {
    if (d.state === "no-topics") {
      return [
        { label: "Темы", value: "не заданы — скажите, за чем следить" },
        { label: "Заголовок", value: UNKNOWN },
      ];
    }
    if (d.state === "no-search") {
      return [
        { label: "Темы", value: d.topics ?? UNKNOWN },
        { label: "Поиск", value: "не подключён — нет ключа" },
      ];
    }
    if (d.state === "unreachable" || d.items.length === 0) {
      return [
        { label: "Темы", value: d.topics ?? UNKNOWN },
        { label: "Новости", value: "не удалось получить" },
      ];
    }
    return [
      { label: "Главное", value: d.items[0].title },
      { label: "Источник", value: d.items[0].source },
      { label: "Ещё", value: `${d.items.length - 1}` },
      { label: "Темы", value: d.topics ?? UNKNOWN },
    ];
  },
  toAdvice: (d, lang) => {
    if (d.state === "no-topics") {
      const tips =
        lang === "ru"
          ? ["Темы не заданы", "Скажите: следи за новостями про недвижимость и ИИ — и они появятся здесь"]
          : ["No topics set", "Say what to watch and this fills itself in"];
      return { spoken: tips[0], tips };
    }
    if (d.state !== "ok" || d.items.length === 0) {
      const tips =
        lang === "ru"
          ? d.state === "no-search"
            ? ["Поиск не подключён", "Без ключа поиска новости взять неоткуда"]
            : ["Новости не удалось получить", "Поиск не ответил — попробуйте позже"]
          : d.state === "no-search"
            ? ["Search is not connected", "There is nowhere to take news from"]
            : ["Could not fetch the news", "Search did not answer — try again later"];
      return { spoken: tips[0], tips };
    }
    const tips =
      lang === "ru"
        ? [
            d.items[0].title,
            `Ещё ${d.items.length - 1} по темам: ${d.topics}`,
            `Источник — ${d.items[0].source}`,
          ]
        : [d.items[0].title, `${d.items.length - 1} more on: ${d.topics}`, `From ${d.items[0].source}`];
    return { spoken: tips[0], tips };
  },
};
