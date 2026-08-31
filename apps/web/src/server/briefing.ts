import { notesForDay, openTasks, type BrainNote, type NoteTask } from "./brain";
import { fetchEventsForDay, isCalendarConnected, type CalendarEvent } from "./calendar";
import { fetchWeather } from "./weather";

/**
 * What is true this morning, gathered in one pass.
 *
 * It is spoken, never volunteered: he decided the system does not talk first,
 * so this runs when he asks for it and at no other time.
 *
 * The distinction the whole file is built around is between **empty and
 * unknown**. A day with no meetings and a calendar nobody connected look
 * identical from in here, and saying "встреч нет" for the second is a lie he
 * would act on. Every part that could be missing is carried as null and said
 * as "not connected", never rounded down to zero. This is the same lesson the
 * hand-rate readout cost a session to learn.
 */

export interface Briefing {
  /** Always known, whatever else is missing. */
  date: string;
  weather: string | null;
  /** Null when no calendar is connected; empty when the day is genuinely clear. */
  events: CalendarEvent[] | null;
  notes: BrainNote[];
  tasks: NoteTask[];
}

const WEEKDAYS = [
  "воскресенье", "понедельник", "вторник", "среда",
  "четверг", "пятница", "суббота",
];
const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

function describeDay(day: Date): string {
  return `${WEEKDAYS[day.getDay()]}, ${day.getDate()} ${MONTHS[day.getMonth()]}`;
}

function clock(at: Date): string {
  return `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
}

/**
 * Gathers every part, and lets each fail on its own.
 *
 * One source being unreachable must not cost him the rest of the briefing —
 * the weather station being down is not a reason to withhold his own meetings.
 */
export async function gatherBriefing(options: { place?: string; day?: Date } = {}): Promise<Briefing> {
  const day = options.day ?? new Date();

  const [weather, events, notes, tasks] = await Promise.all([
    options.place
      ? fetchWeather({ place: options.place, lang: "ru" })
          .then((w) => `${w.place}: ${w.temperature}°C, сегодня от ${w.low}°C до ${w.high}°C`)
          .catch(() => null)
      : Promise.resolve(null),
    isCalendarConnected()
      ? fetchEventsForDay(day).then((read) => read?.events ?? null)
      : Promise.resolve(null),
    notesForDay(day).catch(() => []),
    openTasks().catch(() => []),
  ]);

  return { date: describeDay(day), weather, events, notes, tasks };
}

/**
 * The briefing as the model receives it — compact, and honest about its gaps.
 *
 * Written for a reader whose answer is spoken aloud, so it is a handful of
 * short lines rather than a document. What is missing is named as missing, so
 * the model has something true to say instead of filling the silence.
 */
export function briefingToText(briefing: Briefing): string {
  const lines: string[] = [`Сегодня: ${briefing.date}.`];

  lines.push(
    briefing.weather
      ? `Погода — ${briefing.weather}.`
      : "Погода — не спрашивал: город не указан. Спроси его, где он, и запомни.",
  );

  if (briefing.events === null) {
    lines.push("Календарь не подключён — про встречи сказать нечего.");
  } else if (briefing.events.length === 0) {
    lines.push("В календаре встреч нет.");
  } else {
    lines.push("Встречи:");
    for (const event of briefing.events) {
      lines.push(event.allDay ? `- весь день — ${event.summary}` : `- ${clock(event.start)} — ${event.summary}`);
    }
  }

  if (briefing.notes.length) {
    lines.push("В заметках на сегодня:");
    for (const note of briefing.notes) lines.push(`- ${note.title}: ${note.excerpt}`);
  }

  if (briefing.tasks.length) {
    lines.push("Не закрыто:");
    for (const task of briefing.tasks) lines.push(`- ${task.text} (${task.note})`);
  }

  return lines.join("\n");
}
