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
  themeColor: "#4fd1c5",
  dataProvider: createMockProvider<CalendarSnapshot>({
    nextEvent: "Design review — 15:00",
    eventsToday: 4,
  }),
};
