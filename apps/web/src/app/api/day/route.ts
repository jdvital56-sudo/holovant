import { NextResponse } from "next/server";
import { fetchEventsForDay, isCalendarConnected } from "@/server/calendar";
import { getUserPlace } from "@/server/userMemory";
import { fetchWeather } from "@/server/weather";

export const runtime = "nodejs";

/**
 * What the calendar and weather cards read, so they stop inventing.
 *
 * Both halves are gathered here rather than in the browser for the same reason
 * the notes are: the calendar address and the user's own memory are the
 * server's to hold, and a card should not be able to ask for a city that was
 * never his.
 *
 * The shape is built around one rule. **Unknown is never a number.** A card
 * that cannot reach its source says so; it does not fall back to something
 * plausible. An invented 21° is worse than a dash, because he would dress for
 * it — and a calendar nobody connected, reported as a clear day, is worse
 * still.
 */

export interface DayWeather {
  state: "ok" | "no-place" | "unreachable";
  place: string | null;
  temperatureC: number | null;
  high: number | null;
  low: number | null;
  condition: "clear" | "clouds" | "rain" | "fog" | null;
}

export interface DayCalendar {
  state: "ok" | "not-connected" | "unreachable";
  eventsToday: number | null;
  nextEvent: string | null;
  /** How many entries the whole feed holds — a clear day is not an empty feed. */
  total: number | null;
}

export interface DayReport {
  weather: DayWeather;
  calendar: DayCalendar;
}

/** Open-Meteo's numbered codes, in the four buckets the card draws. */
function conditionFor(code: number): DayWeather["condition"] {
  if (code === 0 || code === 1) return "clear";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51) return "rain";
  return "clouds";
}

async function readWeather(): Promise<DayWeather> {
  const place = await getUserPlace().catch(() => null);
  const blank = { place, temperatureC: null, high: null, low: null, condition: null } as const;
  if (!place) return { ...blank, state: "no-place", place: null };

  try {
    const w = await fetchWeather({ place, lang: "ru" });
    return {
      state: "ok",
      place: w.place,
      temperatureC: w.temperature,
      high: w.high,
      low: w.low,
      condition: conditionFor(w.code),
    };
  } catch (error) {
    console.error("[day] weather could not be read:", error);
    return { ...blank, state: "unreachable" };
  }
}

function clock(at: Date): string {
  return `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
}

async function readCalendar(): Promise<DayCalendar> {
  const blank = { eventsToday: null, nextEvent: null, total: null } as const;
  if (!isCalendarConnected()) return { ...blank, state: "not-connected" };

  const read = await fetchEventsForDay(new Date());
  if (!read) return { ...blank, state: "unreachable" };

  const [next] = read.events;
  return {
    state: "ok",
    eventsToday: read.events.length,
    nextEvent: next ? (next.allDay ? `весь день — ${next.summary}` : `${clock(next.start)} — ${next.summary}`) : null,
    total: read.total,
  };
}

export async function GET() {
  const [weather, calendar] = await Promise.all([readWeather(), readCalendar()]);
  const report: DayReport = { weather, calendar };
  return NextResponse.json(report);
}
