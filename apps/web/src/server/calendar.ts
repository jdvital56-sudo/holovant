/**
 * The user's calendar, read from the private iCal address their provider
 * publishes.
 *
 * Chosen over an API with sign-in because of what it costs him: a link copied
 * out of the calendar's own settings, pasted into `.env.local` beside the other
 * keys. No OAuth application to register, no consent screen, no tokens to
 * refresh at three in the morning. It is read-only, which is the whole of what
 * a briefing needs.
 *
 * The parser here is deliberately small, but it does expand repeating events.
 * Most of what is in a real calendar repeats — the weekly planning call is one
 * entry and a rule, not fifty entries — so a reader that only looked at each
 * event's first date would report an empty day all year while appearing to
 * work perfectly.
 */

export interface CalendarEvent {
  /** When it starts. Midnight local time for an all-day entry. */
  start: Date;
  allDay: boolean;
  summary: string;
}

/** Spoken aloud, so a genuinely full day is said as a count rather than a list. */
const MAX_EVENTS = 12;
const UNTITLED = "Без названия";

/** iCal folds long lines by continuing them with a leading space or tab. */
function unfold(text: string): string[] {
  const lines: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

/** Turns iCal's escapes back into the characters they stand for. */
function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * `DTSTART:20260831T090000Z`, `DTSTART;TZID=Europe/Kyiv:20260831T090000`, or
 * `DTSTART;VALUE=DATE:20260831`.
 *
 * A floating or zoned time is read as local. The server runs on the machine
 * the person is sitting at, so local is the time they will actually keep.
 */
function parseDateValue(raw: string): { date: Date; allDay: boolean } | null {
  const value = raw.trim();
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    return { date: new Date(Number(y), Number(m) - 1, Number(d)), allDay: true };
  }

  const timed = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(value);
  if (!timed) return null;
  const [, y, m, d, hh, mm, ss, zulu] = timed;
  const parts = [Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss)] as const;
  const date = zulu ? new Date(Date.UTC(...parts)) : new Date(...parts);
  return { date, allDay: false };
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

/** Whole days between two dates, ignoring the time of day and any daylight shift. */
function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86_400_000);
}

const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

interface Rule {
  freq: string;
  interval: number;
  byDay: string[];
  until: Date | null;
  count: number | null;
}

function parseRule(raw: string): Rule | null {
  const parts = new Map<string, string>();
  for (const piece of raw.split(";")) {
    const at = piece.indexOf("=");
    if (at > 0) parts.set(piece.slice(0, at).toUpperCase(), piece.slice(at + 1));
  }
  const freq = parts.get("FREQ")?.toUpperCase();
  if (!freq) return null;

  const until = parts.get("UNTIL");
  return {
    freq,
    interval: Math.max(1, Number(parts.get("INTERVAL") ?? 1) || 1),
    byDay: (parts.get("BYDAY") ?? "")
      .split(",")
      .map((d) => d.trim().slice(-2).toUpperCase())
      .filter(Boolean),
    until: until ? (parseDateValue(until)?.date ?? null) : null,
    count: parts.get("COUNT") ? Number(parts.get("COUNT")) : null,
  };
}

/**
 * Whether a repeating event falls on this day.
 *
 * Counts occurrences from the start rather than expanding them into a list:
 * the question is only ever about one day, and a daily event running since
 * January is two hundred and forty dates nobody needs to build.
 */
function occursOn(rule: Rule, start: Date, day: Date): boolean {
  if (day < new Date(start.getFullYear(), start.getMonth(), start.getDate())) return false;
  if (rule.until && day > rule.until) return false;

  const elapsedDays = daysBetween(start, day);
  let index: number;

  switch (rule.freq) {
    case "DAILY":
      if (elapsedDays % rule.interval !== 0) return false;
      index = elapsedDays / rule.interval;
      break;

    case "WEEKLY": {
      const wanted = rule.byDay.length ? rule.byDay : [WEEKDAYS[start.getDay()]];
      if (!wanted.includes(WEEKDAYS[day.getDay()])) return false;
      // Weeks are counted from the start's own week, so INTERVAL=2 keeps its
      // phase regardless of which weekday within the week is being asked about.
      const weeks = Math.floor((elapsedDays + start.getDay()) / 7);
      if (weeks % rule.interval !== 0) return false;
      index = weeks * wanted.length;
      break;
    }

    case "MONTHLY": {
      if (day.getDate() !== start.getDate()) return false;
      const months =
        (day.getFullYear() - start.getFullYear()) * 12 + (day.getMonth() - start.getMonth());
      if (months % rule.interval !== 0) return false;
      index = months / rule.interval;
      break;
    }

    case "YEARLY": {
      if (day.getDate() !== start.getDate() || day.getMonth() !== start.getMonth()) return false;
      const years = day.getFullYear() - start.getFullYear();
      if (years % rule.interval !== 0) return false;
      index = years / rule.interval;
      break;
    }

    default:
      // An unsupported rule reports only its first date rather than every day.
      return sameDay(start, day);
  }

  if (rule.count !== null && index >= rule.count) return false;
  return true;
}

interface RawEvent {
  start?: { date: Date; allDay: boolean };
  summary?: string;
  rule?: Rule | null;
  excluded: Date[];
  cancelled: boolean;
}

function parseEvents(text: string): RawEvent[] {
  const events: RawEvent[] = [];
  let current: RawEvent | null = null;

  for (const line of unfold(text)) {
    if (line.startsWith("BEGIN:VEVENT")) {
      current = { excluded: [], cancelled: false };
      continue;
    }
    if (line.startsWith("END:VEVENT")) {
      if (current) events.push(current);
      current = null;
      continue;
    }
    if (!current) continue;

    const at = line.indexOf(":");
    if (at < 0) continue;
    const name = line.slice(0, at).split(";")[0].toUpperCase();
    const value = line.slice(at + 1);

    if (name === "DTSTART") current.start = parseDateValue(value) ?? undefined;
    else if (name === "SUMMARY") current.summary = unescapeText(value);
    else if (name === "RRULE") current.rule = parseRule(value);
    else if (name === "STATUS") current.cancelled = value.trim().toUpperCase() === "CANCELLED";
    else if (name === "EXDATE") {
      for (const one of value.split(",")) {
        const parsed = parseDateValue(one);
        if (parsed) current.excluded.push(parsed.date);
      }
    }
  }

  return events;
}

/**
 * Everything on one day, in the order it happens.
 *
 * Takes the feed and the day rather than reading the clock, so every awkward
 * case is arithmetic in a test instead of something noticed one morning when
 * the briefing turns out to be wrong.
 */
export function eventsForDay(ics: string, day: Date): CalendarEvent[] {
  const found: CalendarEvent[] = [];

  for (const raw of parseEvents(ics)) {
    if (!raw.start || raw.cancelled) continue;
    const { date: start, allDay } = raw.start;

    const happens = raw.rule ? occursOn(raw.rule, start, day) : sameDay(start, day);
    if (!happens) continue;
    if (raw.excluded.some((excluded) => sameDay(excluded, day))) continue;

    // A repeat keeps the time of the original and takes the day being asked for.
    const at = allDay
      ? new Date(day.getFullYear(), day.getMonth(), day.getDate())
      : new Date(
          day.getFullYear(),
          day.getMonth(),
          day.getDate(),
          start.getHours(),
          start.getMinutes(),
        );

    found.push({ start: at, allDay, summary: raw.summary || UNTITLED });
  }

  return found.sort((a, b) => a.start.getTime() - b.start.getTime()).slice(0, MAX_EVENTS);
}

export function isCalendarConnected(): boolean {
  return Boolean(process.env.HOLOVANT_CALENDAR_ICS?.trim());
}

/**
 * Fetches the feed and reads one day out of it.
 *
 * A calendar that cannot be reached is an empty day, not an error: the rest of
 * the briefing is still worth hearing, and the assistant can say the calendar
 * would not answer.
 */
export async function fetchEventsForDay(
  day: Date,
): Promise<{ events: CalendarEvent[]; total: number } | null> {
  const url = process.env.HOLOVANT_CALENDAR_ICS?.trim();
  if (!url) return null;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const ics = await response.text();
    // The feed's own size travels with the answer. Telling an empty day from a
    // feed that parsed to nothing took a script the first time it mattered,
    // and anything that has to be found out by hand once will have to be found
    // out by hand every time.
    return { events: eventsForDay(ics, day), total: countEvents(ics) };
  } catch (error) {
    console.error("[calendar] could not be read:", error);
    return null;
  }
}

/** How many entries the feed holds at all, whatever day they fall on. */
export function countEvents(ics: string): number {
  return parseEvents(ics).length;
}
