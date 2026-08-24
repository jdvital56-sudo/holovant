import type { ModuleDefinition } from "@holovant/module-contracts";
import { createMockProvider } from "@/lib/createMockProvider";

export interface CalendarSnapshot {
  nextEvent: string;
  eventsToday: number;
}

export const calendarModule: ModuleDefinition<CalendarSnapshot> = {
  id: "calendar",
  label: "Calendar",
  tagline: "Today's schedule",
  themeColor: "#59b5e5",
  dataProvider: createMockProvider<CalendarSnapshot>({
    nextEvent: "Design review — 15:00",
    eventsToday: 4,
  }),
  toMetrics: (d) => [
    { label: "Next event", value: d.nextEvent },
    { label: "Events today", value: `${d.eventsToday}` },
  ],
  toAdvice: (d, lang) => {
    const busy = d.eventsToday >= 4;
    const tips =
      lang === "ru"
        ? [
            `Сегодня ${d.eventsToday} встреч, ближайшая — ${d.nextEvent}`,
            busy
              ? "День плотный — глубокую работу между встречами не планируйте, она не поместится"
              : "День свободный — хороший момент для длинной задачи",
            "Заложите 10 минут на подготовку перед ближайшей встречей",
          ]
        : [
            `${d.eventsToday} meetings today, next is ${d.nextEvent}`,
            busy
              ? "A packed day — do not plan deep work between meetings, it will not fit"
              : "A light day — a good window for something long",
            "Leave 10 minutes to prepare before the next one",
          ];
    return { spoken: `${tips[0]}. ${tips[1]}`, tips };
  },
};
