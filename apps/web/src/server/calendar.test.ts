import { describe, expect, it } from "vitest";
import { countEvents, eventsForDay } from "@/server/calendar";

/**
 * Today's events, read out of a calendar feed.
 *
 * The whole feed is parsed here against a fixed day rather than "now", so the
 * awkward cases — a weekly meeting, a series that ended in March, a single
 * cancelled morning — are arithmetic instead of something to be noticed one
 * morning when the briefing is wrong.
 *
 * Both directions, and the second is the one that matters: a calendar that
 * quietly drops repeating events is worse than no calendar at all, because it
 * looks like it is working. Most of what is in a real calendar repeats.
 */

/** Wraps events in the envelope a real feed has, so the parser sees what it will see. */
function feed(...events: string[]): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Google Inc//Google Calendar 70.9054//EN",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

function event(...lines: string[]): string {
  return ["BEGIN:VEVENT", "UID:test@holovant", ...lines, "END:VEVENT"].join("\r\n");
}

/** Monday, 31 August 2026. */
const MONDAY = new Date(2026, 7, 31);

describe("what must appear in the morning", () => {
  it("finds a meeting set for today", () => {
    const events = eventsForDay(
      feed(event("DTSTART:20260831T090000Z", "DTEND:20260831T100000Z", "SUMMARY:Звонок с Дубистэй")),
      MONDAY,
    );
    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe("Звонок с Дубистэй");
    expect(events[0].allDay).toBe(false);
  });

  it("finds an all-day event, and knows it has no time", () => {
    const events = eventsForDay(
      feed(event("DTSTART;VALUE=DATE:20260831", "DTEND;VALUE=DATE:20260901", "SUMMARY:Отпуск")),
      MONDAY,
    );
    expect(events).toHaveLength(1);
    expect(events[0].allDay).toBe(true);
  });

  it("finds a weekly meeting on its weekday, months after it began", () => {
    // The case that decides whether this is worth having. A standup set up in
    // January is not in the feed as three hundred events; it is one event and
    // a rule, and a parser that reads only the first date reports nothing all
    // year while looking perfectly healthy.
    const events = eventsForDay(
      feed(
        event(
          "DTSTART:20260105T080000Z",
          "DTEND:20260105T083000Z",
          "RRULE:FREQ=WEEKLY;BYDAY=MO",
          "SUMMARY:Планёрка",
        ),
      ),
      MONDAY,
    );
    expect(events.map((e) => e.summary)).toEqual(["Планёрка"]);
  });

  it("finds a daily one, and a monthly one on its day of the month", () => {
    const events = eventsForDay(
      feed(
        event("DTSTART:20260101T060000Z", "RRULE:FREQ=DAILY", "SUMMARY:Зарядка"),
        event("DTSTART:20260131T120000Z", "RRULE:FREQ=MONTHLY", "SUMMARY:Счета"),
      ),
      MONDAY,
    );
    expect(events.map((e) => e.summary).sort()).toEqual(["Зарядка", "Счета"]);
  });

  it("puts the morning before the afternoon", () => {
    const events = eventsForDay(
      feed(
        event("DTSTART:20260831T150000Z", "SUMMARY:Позже"),
        event("DTSTART:20260831T070000Z", "SUMMARY:Раньше"),
      ),
      MONDAY,
    );
    expect(events.map((e) => e.summary)).toEqual(["Раньше", "Позже"]);
  });

  it("reads a title split across folded lines, and unescapes what iCal escaped", () => {
    const folded = [
      "BEGIN:VEVENT",
      "UID:folded@holovant",
      "DTSTART:20260831T090000Z",
      "SUMMARY:Разговор про недвижимость\\, аренду",
      // Two spaces: the first is the fold's own delimiter and is eaten, the
      // second is a space that was really in the title. Getting this backwards
      // is how folded titles come out with their words run together.
      "  и оливки",
      "END:VEVENT",
    ].join("\r\n");
    const events = eventsForDay(feed(folded), MONDAY);
    expect(events[0].summary).toBe("Разговор про недвижимость, аренду и оливки");
  });
});

describe("what must not appear in the morning", () => {
  it("leaves out yesterday and tomorrow", () => {
    const events = eventsForDay(
      feed(
        event("DTSTART:20260830T090000Z", "SUMMARY:Вчера"),
        event("DTSTART:20260901T090000Z", "SUMMARY:Завтра"),
      ),
      MONDAY,
    );
    expect(events).toEqual([]);
  });

  it("leaves out a weekly meeting on the wrong weekday", () => {
    const events = eventsForDay(
      feed(event("DTSTART:20260106T080000Z", "RRULE:FREQ=WEEKLY;BYDAY=TU", "SUMMARY:Вторничная")),
      MONDAY,
    );
    expect(events).toEqual([]);
  });

  it("leaves out a series that has already ended", () => {
    // The standup that stopped in spring must not still be read out in autumn.
    const events = eventsForDay(
      feed(
        event(
          "DTSTART:20260105T080000Z",
          "RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20260330T000000Z",
          "SUMMARY:Закончилась",
        ),
      ),
      MONDAY,
    );
    expect(events).toEqual([]);
  });

  it("leaves out a series that has run out of repeats", () => {
    const events = eventsForDay(
      feed(event("DTSTART:20260105T080000Z", "RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=4", "SUMMARY:Четыре раза")),
      MONDAY,
    );
    expect(events).toEqual([]);
  });

  it("leaves out the one morning of a series that was cancelled", () => {
    // A repeating event with today struck out of it. Reporting it would send
    // him to a meeting nobody else is at.
    const events = eventsForDay(
      feed(
        event(
          "DTSTART:20260105T080000Z",
          "RRULE:FREQ=WEEKLY;BYDAY=MO",
          "EXDATE:20260831T080000Z",
          "SUMMARY:Отменена именно сегодня",
        ),
      ),
      MONDAY,
    );
    expect(events).toEqual([]);
  });

  it("leaves out an event marked cancelled", () => {
    const events = eventsForDay(
      feed(event("DTSTART:20260831T090000Z", "STATUS:CANCELLED", "SUMMARY:Отменено")),
      MONDAY,
    );
    expect(events).toEqual([]);
  });
});

describe("what must not break the morning", () => {
  it("reads an empty calendar as an empty day", () => {
    expect(eventsForDay(feed(), MONDAY)).toEqual([]);
  });

  it("reads nonsense as an empty day rather than throwing", () => {
    // A feed can be an error page, a login redirect, or half a download. None
    // of that is a reason for the assistant to fall silent.
    for (const rubbish of ["", "<html>Sign in</html>", "BEGIN:VCALENDAR", " "]) {
      expect(eventsForDay(rubbish, MONDAY), rubbish.slice(0, 12)).toEqual([]);
    }
  });

  it("skips an event with no start rather than dropping the whole day", () => {
    const events = eventsForDay(
      feed(event("SUMMARY:Без даты"), event("DTSTART:20260831T090000Z", "SUMMARY:С датой")),
      MONDAY,
    );
    expect(events.map((e) => e.summary)).toEqual(["С датой"]);
  });

  it("gives an untitled event a name rather than an empty line", () => {
    const events = eventsForDay(feed(event("DTSTART:20260831T090000Z")), MONDAY);
    expect(events[0].summary.length).toBeGreaterThan(0);
  });

  it("counts what the whole feed holds, so a clear day is not a broken parser", () => {
    // Told apart by hand once, with a script, before it went into the product.
    // A day with nothing on it and a feed that parsed to nothing look the same
    // from outside, and only one of them is worth waking anyone about.
    const ics = feed(
      event("DTSTART:20240815T143000Z", "SUMMARY:Позапрошлый год"),
      event("DTSTART:20220202T060000Z", "SUMMARY:И ещё раньше"),
    );
    expect(countEvents(ics)).toBe(2);
    expect(eventsForDay(ics, MONDAY)).toEqual([]);
  });

  it("does not read out a hundred events", () => {
    // It is spoken aloud. A day that is genuinely that full is said as a
    // count, not as a list.
    const many = Array.from({ length: 100 }, (_, i) =>
      event(`DTSTART:20260831T0${String(i % 10)}0000Z`, `SUMMARY:Встреча ${i}`),
    );
    expect(eventsForDay(feed(...many), MONDAY).length).toBeLessThanOrEqual(12);
  });
});
