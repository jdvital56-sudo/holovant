import type { ModuleDefinition } from "@holovant/module-contracts";
import type { DayCalendar } from "@/app/api/day/route";
import { createDayProvider } from "@/lib/createDayProvider";

/**
 * His real calendar, through the private iCal address.
 *
 * The card used to promise "Design review — 15:00" and four meetings to
 * everyone who opened it. The distinction it exists to keep now is the one the
 * briefing keeps: **a calendar nobody connected is not a clear day.** From
 * inside the code both are an empty list, and only one of them means he has
 * nothing on.
 */
export type CalendarSnapshot = DayCalendar;

const UNKNOWN = "—";

export const calendarModule: ModuleDefinition<CalendarSnapshot> = {
  id: "calendar",
  label: "Calendar",
  tagline: "Today's schedule",
  themeColor: "#59b5e5",
  dataProvider: createDayProvider<CalendarSnapshot>("calendar", {
    state: "unreachable",
    eventsToday: null,
    nextEvent: null,
    total: null,
  }),
  toMetrics: (d) => {
    if (d.state === "not-connected") {
      return [
        { label: "Календарь", value: "не подключён" },
        { label: "Ближайшее", value: UNKNOWN },
      ];
    }
    if (d.state === "unreachable") {
      return [
        { label: "Календарь", value: "не удалось прочитать" },
        { label: "Ближайшее", value: UNKNOWN },
      ];
    }
    return [
      { label: "Сегодня", value: d.eventsToday === 0 ? "встреч нет" : `${d.eventsToday}` },
      { label: "Ближайшее", value: d.nextEvent ?? "ничего не запланировано" },
    ];
  },
  toAdvice: (d, lang) => {
    if (d.state !== "ok" || d.eventsToday === null) {
      const tips =
        lang === "ru"
          ? d.state === "not-connected"
            ? ["Календарь не подключён", "Пока он не подключён, о встречах сказать нечего"]
            : ["Календарь не удалось прочитать", "Ссылка на месте, но лента не открылась"]
          : d.state === "not-connected"
            ? ["No calendar connected", "Nothing can be said about meetings until there is one"]
            : ["The calendar would not load", "The link is set but the feed did not answer"];
      return { spoken: tips[0], tips };
    }

    if (d.eventsToday === 0) {
      const tips =
        lang === "ru"
          ? ["Сегодня встреч нет", "День свободен — хороший момент для длинной задачи"]
          : ["No meetings today", "A clear day — a good window for something long"];
      return { spoken: tips[0], tips };
    }

    const busy = d.eventsToday >= 4;
    const tips =
      lang === "ru"
        ? [
            `Сегодня встреч: ${d.eventsToday}, ближайшая — ${d.nextEvent}`,
            busy
              ? "День плотный — глубокую работу между встречами не планируйте, она не поместится"
              : "День не забит — между встречами помещается длинная задача",
            "Заложите 10 минут на подготовку перед ближайшей",
          ]
        : [
            `${d.eventsToday} today, next is ${d.nextEvent}`,
            busy
              ? "A packed day — do not plan deep work between meetings, it will not fit"
              : "A light day — something long fits between them",
            "Leave 10 minutes to prepare before the next one",
          ];
    return { spoken: `${tips[0]}. ${tips[1]}`, tips };
  },
};
