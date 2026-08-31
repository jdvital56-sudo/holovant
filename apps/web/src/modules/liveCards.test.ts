import { describe, expect, it } from "vitest";
import { calendarModule, type CalendarSnapshot } from "./calendar";
import { weatherModule, type WeatherSnapshot } from "./weather";

/**
 * The two cards that stopped inventing.
 *
 * Every module in the ring showed numbers somebody made up. These two now read
 * the sources that are actually connected — his calendar feed and the weather
 * for the city he last said he was in — and the whole risk of that change is
 * one thing: **a card that cannot reach its source must say so, not fall back
 * to a plausible number.** An invented 21° is worse than a dash, because he
 * would dress for it.
 *
 * So each state is checked in both directions: the real figure shows when it
 * is known, and nothing that looks like a figure shows when it is not.
 */

/** Anything a reader would take for a measurement. */
function looksLikeAReading(text: string): boolean {
  return /\d/.test(text);
}

describe("the weather card", () => {
  const known: WeatherSnapshot = {
    state: "ok",
    place: "Аланья",
    temperatureC: 34,
    high: 35,
    low: 28,
    condition: "clear",
  };

  it("shows the real temperature for the city he named", () => {
    const metrics = weatherModule.toMetrics(known);
    expect(metrics.some((m) => m.value.includes("34"))).toBe(true);
    expect(metrics.some((m) => m.value.includes("Аланья"))).toBe(true);
  });

  it("shows no number at all when he has not said where he is", () => {
    // It used to say 21° in an empty room, always, to everyone.
    const metrics = weatherModule.toMetrics({
      state: "no-place",
      place: null,
      temperatureC: null,
      high: null,
      low: null,
      condition: null,
    });
    for (const metric of metrics) expect(looksLikeAReading(metric.value), metric.label).toBe(false);
    expect(metrics.some((m) => /не знаю|не указан|скажите/i.test(m.value))).toBe(true);
  });

  it("shows no number when the weather could not be reached", () => {
    const metrics = weatherModule.toMetrics({
      state: "unreachable",
      place: "Аланья",
      temperatureC: null,
      high: null,
      low: null,
      condition: null,
    });
    for (const metric of metrics) {
      if (metric.value.includes("Аланья")) continue;
      expect(looksLikeAReading(metric.value), metric.label).toBe(false);
    }
  });

  it("advises on what it knows, and admits it when it knows nothing", () => {
    expect(weatherModule.toAdvice(known, "ru").spoken).toMatch(/34/);
    const blind = weatherModule.toAdvice(
      { state: "no-place", place: null, temperatureC: null, high: null, low: null, condition: null },
      "ru",
    );
    expect(blind.spoken).not.toMatch(/\d/);
    expect(blind.spoken).toMatch(/город/i);
  });
});

describe("the calendar card", () => {
  const busy: CalendarSnapshot = {
    state: "ok",
    eventsToday: 2,
    nextEvent: "09:00 — Планёрка",
    total: 134,
  };

  it("shows what is really on today", () => {
    const metrics = calendarModule.toMetrics(busy);
    expect(metrics.some((m) => m.value.includes("2"))).toBe(true);
    expect(metrics.some((m) => m.value.includes("Планёрка"))).toBe(true);
  });

  it("says the day is clear only when it actually read the calendar", () => {
    const clear = calendarModule.toMetrics({
      state: "ok",
      eventsToday: 0,
      nextEvent: null,
      total: 134,
    });
    expect(clear.some((m) => /нет|свободн/i.test(m.value))).toBe(true);
  });

  it("says it is not connected rather than calling the day clear", () => {
    // The same lie as the briefing's, on a card instead of out loud: from
    // inside the code an unconnected calendar and an empty day are one empty
    // list, and only one of them means he has nothing on.
    const metrics = calendarModule.toMetrics({
      state: "not-connected",
      eventsToday: null,
      nextEvent: null,
      total: null,
    });
    expect(metrics.some((m) => /не подключ/i.test(m.value))).toBe(true);
    expect(metrics.some((m) => /нет встреч|свободн/i.test(m.value))).toBe(false);
    for (const metric of metrics) expect(looksLikeAReading(metric.value), metric.label).toBe(false);
  });

  it("says it could not be read when the feed would not load", () => {
    const metrics = calendarModule.toMetrics({
      state: "unreachable",
      eventsToday: null,
      nextEvent: null,
      total: null,
    });
    expect(metrics.some((m) => /не удалось|не прочит/i.test(m.value))).toBe(true);
    expect(metrics.some((m) => /нет встреч|свободн/i.test(m.value))).toBe(false);
  });

  it("advises about a real day and stays quiet about one it cannot see", () => {
    expect(calendarModule.toAdvice(busy, "ru").spoken).toMatch(/2|Планёрка/);
    const blind = calendarModule.toAdvice(
      { state: "not-connected", eventsToday: null, nextEvent: null, total: null },
      "ru",
    );
    expect(blind.spoken).toMatch(/не подключ/i);
  });
});
