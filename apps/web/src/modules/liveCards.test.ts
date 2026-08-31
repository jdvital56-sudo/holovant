import { describe, expect, it } from "vitest";
import { aiModule, type AiSnapshot } from "./ai";
import { brainModule, type BrainSnapshot } from "./brain";
import { calendarModule, type CalendarSnapshot } from "./calendar";
import { projectsModule, type ProjectsSnapshot } from "./projects";
import { systemModule, type SystemSnapshot } from "./system";
import { describeAge } from "@/server/projects";
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

describe("the second brain card", () => {
  it("counts what is really in the vault, and names what he touched last", () => {
    const metrics = brainModule.toMetrics({
      state: "ok",
      noteCount: 412,
      recent: ["Дубистэй", "Serenity Spa", "voxlocal-win"],
    } as BrainSnapshot);
    expect(metrics.some((m) => m.value.includes("412"))).toBe(true);
    expect(metrics.some((m) => m.value.includes("Дубистэй"))).toBe(true);
  });

  it("shows no count when no vault is connected", () => {
    // It shipped saying zero notes, which reads as an empty vault rather than
    // as no vault — and those want opposite things from the reader.
    const metrics = brainModule.toMetrics({ state: "not-connected", noteCount: null, recent: [] });
    expect(metrics.some((m) => /не подключ/i.test(m.value))).toBe(true);
    for (const metric of metrics) expect(/\d/.test(metric.value), metric.label).toBe(false);
  });
});

describe("the projects card", () => {
  const real: ProjectsSnapshot = {
    state: "ok",
    count: 4,
    repos: [
      { name: "holovant", branch: "master", age: "8 минут назад", uncommitted: 16 },
      { name: "nexus-os", branch: "main", age: "55 минут назад", uncommitted: 4 },
      { name: "gods-eye-view", branch: "main", age: "3 дня назад", uncommitted: 0 },
      { name: "nexus-os-business", branch: "fix/audit-remediation", age: "2 месяца назад", uncommitted: 35 },
    ],
  };

  it("names the repository he was last inside, and where he left it", () => {
    const metrics = projectsModule.toMetrics(real);
    expect(metrics.some((m) => m.value.includes("holovant"))).toBe(true);
    expect(metrics.some((m) => m.value.includes("master"))).toBe(true);
    expect(metrics.some((m) => m.value.includes("4"))).toBe(true);
  });

  it("agrees the words with their numbers, which a synthesiser will read aloud", () => {
    // "3 дня" and "5 дней" are different words, and "5 дня" is the difference
    // between a product and a toy — his phrase, and the reason pluralRu exists.
    const spoken = projectsModule.toAdvice(real, "ru").tips.join(" ");
    // Every age in the table above is agreed; the point here is that the card passes them through unchanged.
    expect(spoken).toContain("8 минут назад");
  });

  it("says nothing was found rather than showing an empty list as an answer", () => {
    const metrics = projectsModule.toMetrics({ state: "ok", count: 0, repos: [] });
    expect(metrics.some((m) => /ни одного|не найден/i.test(m.value))).toBe(true);
  });

  it("says the folder is not set, which is not the same as having no projects", () => {
    const metrics = projectsModule.toMetrics({ state: "not-connected", count: null, repos: [] });
    expect(metrics.some((m) => /не указан/i.test(m.value))).toBe(true);
    for (const metric of metrics) expect(/\d/.test(metric.value), metric.label).toBe(false);
  });

  it("warns about what is left uncommitted, by name", () => {
    // The one thing on this card he can lose: work that exists nowhere else.
    const spoken = projectsModule.toAdvice(real, "ru").tips.join(" ");
    expect(spoken).toContain("holovant");
    expect(spoken).toMatch(/незакоммичено/i);
  });

  it("says everything is committed when it is, instead of staying silent", () => {
    const clean = projectsModule.toAdvice(
      { state: "ok", count: 1, repos: [{ name: "holovant", branch: "master", age: "час назад", uncommitted: 0 }] },
      "ru",
    );
    expect(clean.tips.join(" ")).toMatch(/везде закоммичено/i);
  });
});

describe("the assistant card", () => {
  it("names the model actually configured, not a category", () => {
    const metrics = aiModule.toMetrics({
      model: "deepseek-chat",
      configured: true,
      voice: "piper",
      searchConfigured: true,
    } as AiSnapshot);
    expect(metrics.some((m) => m.value.includes("deepseek-chat"))).toBe(true);
  });

  it("says the assistant cannot answer when there is no key, rather than idling", () => {
    // "idle" was what it said with no model configured at all — which reads as
    // resting, and it is not resting, it is absent.
    const metrics = aiModule.toMetrics({
      model: null,
      configured: false,
      voice: "browser",
      searchConfigured: false,
    });
    expect(metrics.some((m) => /не настроен|нет ключа/i.test(m.value))).toBe(true);
  });

  it("tells the product voice from the browser's, because they are not the same thing", () => {
    const piper = aiModule.toMetrics({ model: "m", configured: true, voice: "piper", searchConfigured: true });
    const browser = aiModule.toMetrics({ model: "m", configured: true, voice: "browser", searchConfigured: true });
    expect(JSON.stringify(piper)).not.toBe(JSON.stringify(browser));
  });
});

describe("the system card", () => {
  const real: SystemSnapshot = {
    platform: "Windows_NT",
    cpuCount: 8,
    memoryUsedPct: 52,
    uptimeHours: 12.4,
  };

  it("reports this machine rather than a picture of one", () => {
    const metrics = systemModule.toMetrics(real);
    expect(metrics.some((m) => m.value.includes("52"))).toBe(true);
    expect(metrics.some((m) => m.value.includes("8"))).toBe(true);
  });

  it("does not claim a processor load nobody measured", () => {
    // It showed CPU 18% and GPU 34% to everyone. Neither is available from the
    // server on Windows, and a made-up load is worse than a missing one.
    const metrics = systemModule.toMetrics(real);
    const labels = metrics.map((m) => m.label.toLowerCase()).join(" ");
    expect(labels).not.toMatch(/gpu/);
  });
});

describe("how long ago, said out loud", () => {
  /**
   * A synthesiser reads exactly what is written, so "5 дня назад" comes out as
   * "пять дня назад" — wrong in a way any Russian speaker hears at once. This
   * is the table of the forms, including the teens, where the rule inverts.
   */
  it("agrees the noun with the number", () => {
    expect(describeAge(60)).toBe("1 минуту назад");
    expect(describeAge(3 * 60)).toBe("3 минуты назад");
    expect(describeAge(7 * 60)).toBe("7 минут назад");
    expect(describeAge(60 * 60)).toBe("1 час назад");
    expect(describeAge(3 * 3600)).toBe("3 часа назад");
    expect(describeAge(9 * 3600)).toBe("9 часов назад");
    expect(describeAge(24 * 3600)).toBe("1 день назад");
    expect(describeAge(3 * 24 * 3600)).toBe("3 дня назад");
    expect(describeAge(5 * 24 * 3600)).toBe("5 дней назад");
  });

  it("gets the teens right, where the rule turns over", () => {
    // Eleven to fourteen take the many-form despite ending in one to four:
    // "11 дней", not "11 день".
    expect(describeAge(11 * 60)).toBe("11 минут назад");
    expect(describeAge(12 * 3600)).toBe("12 часов назад");
    expect(describeAge(13 * 24 * 3600)).toBe("13 дней назад");
  });

  it("says the near past as near, not as zero", () => {
    expect(describeAge(5)).toBe("только что");
    expect(describeAge(59)).toBe("только что");
  });

  it("says a repository with no commits has none, rather than being ancient", () => {
    expect(describeAge(null)).toBe("коммитов нет");
  });

  it("rolls up to months so nothing reads as ninety days", () => {
    expect(describeAge(60 * 24 * 3600)).toBe("2 месяца назад");
  });
});

describe("the words under the numbers", () => {
  /**
   * On a card the label sits beneath the figure, so it is read as one phrase:
   * "82 заметки". Russian agrees the noun with the numeral, and a static label
   * gets it wrong for most counts — "82 заметок" is the difference between a
   * product and a toy, which is his phrase and his standard.
   */
  const labelFor = (metrics: { label: string; value: string }[], value: string) =>
    metrics.find((m) => m.value === value)?.label;

  it("agrees the note count", () => {
    const forCount = (noteCount: number) =>
      labelFor(brainModule.toMetrics({ state: "ok", noteCount, recent: [] }), `${noteCount}`);
    expect(forCount(1)).toBe("Заметка");
    expect(forCount(82)).toBe("Заметки");
    expect(forCount(5)).toBe("Заметок");
    expect(forCount(11)).toBe("Заметок");
    expect(forCount(21)).toBe("Заметка");
  });

  it("agrees the project count", () => {
    const forCount = (count: number) =>
      labelFor(projectsModule.toMetrics({ state: "ok", count, repos: [{ name: "x", branch: "main", age: "час назад", uncommitted: 0 }] }), `${count}`);
    expect(forCount(1)).toBe("Проект");
    expect(forCount(4)).toBe("Проекта");
    expect(forCount(7)).toBe("Проектов");
  });

  it("agrees the core count", () => {
    const forCount = (cpuCount: number) =>
      labelFor(
        systemModule.toMetrics({ platform: "Windows_NT", cpuCount, memoryUsedPct: 50, uptimeHours: 1 }),
        `${cpuCount}`,
      );
    expect(forCount(1)).toBe("Ядро");
    expect(forCount(2)).toBe("Ядра");
    expect(forCount(8)).toBe("Ядер");
  });

  it("agrees the meeting count", () => {
    const forCount = (eventsToday: number) =>
      labelFor(
        calendarModule.toMetrics({ state: "ok", eventsToday, nextEvent: "09:00 — Планёрка", total: 10 }),
        `${eventsToday}`,
      );
    expect(forCount(1)).toBe("Встреча");
    expect(forCount(2)).toBe("Встречи");
    expect(forCount(5)).toBe("Встреч");
  });

  it("still says a clear day in words, not as a zero with a noun after it", () => {
    // "0 встреч" reads as a measurement of nothing; "встреч нет" is an answer.
    const metrics = calendarModule.toMetrics({ state: "ok", eventsToday: 0, nextEvent: null, total: 10 });
    expect(metrics.some((m) => m.value === "встреч нет")).toBe(true);
    expect(metrics.some((m) => m.value === "0")).toBe(false);
  });
});
