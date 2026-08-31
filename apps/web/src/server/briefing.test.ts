import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { notesForDay, openTasks } from "@/server/brain";
import { briefingToText, type Briefing } from "@/server/briefing";
import { rememberAboutUser } from "@/server/userMemory";

/**
 * The morning briefing: what is true today, gathered before he asks twice.
 *
 * The line this file is drawn along is the one the hand-rate readout taught:
 * **"no calendar connected" and "nothing in the calendar" are different
 * things**, and saying the second when the first is true is a lie told every
 * morning. The same for weather with no place to ask about. Unknown is said as
 * unknown or not said at all; it is never rounded down to zero.
 */

let vault: string;

beforeEach(async () => {
  vault = await mkdtemp(join(tmpdir(), "holovant-brief-"));
  process.env.HOLOVANT_BRAIN_PATH = vault;
  const cache = globalThis as Record<string, unknown>;
  delete cache.__holovantBrainIndex;
  delete cache.__holovantBrainScanAt;
});

afterEach(() => {
  delete process.env.HOLOVANT_BRAIN_PATH;
  delete process.env.HOLOVANT_USER_MEMORY_PATH;
});

/** Monday, 31 August 2026. */
const MONDAY = new Date(2026, 7, 31);

async function note(name: string, body: string) {
  await mkdir(join(vault, "Заметки"), { recursive: true });
  await writeFile(join(vault, "Заметки", `${name}.md`), body, "utf-8");
}

describe("what today's notes must turn up", () => {
  it("finds a note written against today's date, however he writes dates", async () => {
    // All three are dates he actually writes, and a briefing that only knew
    // one of them would look like it worked until the morning it did not.
    await note("Обычная", "# Обычная\nПлан на 2026-08-31: закрыть жесты.");
    await note("Точками", "# Точками\nВстреча 31.08.2026 по Дубистэй.");
    await note("Словами", "# Словами\n31 августа забрать документы.");
    const found = await notesForDay(MONDAY);
    expect(found.map((n) => n.title).sort()).toEqual(["Обычная", "Словами", "Точками"]);
  });

  it("leaves tomorrow's note for tomorrow", async () => {
    await note("Завтра", "# Завтра\nЭто на 2026-09-01, не на сегодня.");
    expect(await notesForDay(MONDAY)).toEqual([]);
  });

  it("never turns up its own conclusions about him", async () => {
    // The file the assistant writes about him lives in this same vault and
    // carries today's date on every line it adds. Without the marker that
    // hides machine-written notes, every single morning would begin with the
    // assistant reading its own guesses back as today's business.
    await rememberAboutUser("Терминал ему тяжёл — лучше делать самому и показывать результат");
    const found = await notesForDay(new Date());
    expect(found).toEqual([]);
  });

  it("reads an unconnected vault as nothing to report, not as a failure", async () => {
    delete process.env.HOLOVANT_BRAIN_PATH;
    await expect(notesForDay(MONDAY)).resolves.toEqual([]);
    await expect(openTasks()).resolves.toEqual([]);
  });
});

describe("what the open tasks must be", () => {
  it("finds what is still unticked", async () => {
    await note("Дела", "# Дела\n- [ ] позвонить в банк\n- [ ] дописать сводку");
    const tasks = await openTasks();
    expect(tasks.map((t) => t.text).sort()).toEqual(["дописать сводку", "позвонить в банк"]);
  });

  it("leaves out what he has already ticked off", async () => {
    // Reading back a finished task is the fastest way to make a briefing
    // something he stops listening to.
    await note("Дела", "# Дела\n- [x] это сделано\n- [X] и это тоже\n- [ ] а это нет");
    const tasks = await openTasks();
    expect(tasks.map((t) => t.text)).toEqual(["а это нет"]);
  });

  it("says which note a task came from, so it can be found again", async () => {
    await note("Дубистэй", "# Дубистэй\n- [ ] подготовить оффер");
    const [task] = await openTasks();
    expect(task.note).toBe("Дубистэй");
  });

  it("does not read out a hundred of them", async () => {
    const many = Array.from({ length: 60 }, (_, i) => `- [ ] задача ${i}`).join("\n");
    await note("Много", `# Много\n${many}`);
    expect((await openTasks()).length).toBeLessThanOrEqual(8);
  });
});

describe("the difference between empty and unknown", () => {
  const bare: Briefing = {
    date: "понедельник, 31 августа",
    weather: null,
    events: null,
    notes: [],
    tasks: [],
  };

  it("does not say the day is clear when it never saw a calendar", () => {
    // The whole point. "Встреч нет" from a briefing that cannot see the
    // calendar is a lie he would act on.
    const text = briefingToText(bare);
    expect(text).not.toMatch(/встреч нет|ничего не запланировано/i);
    expect(text).toMatch(/календарь не подключ/i);
  });

  it("does say the day is clear when it looked and the day was clear", () => {
    const text = briefingToText({ ...bare, events: [] });
    expect(text).toMatch(/встреч нет/i);
    expect(text).not.toMatch(/не подключ/i);
  });

  it("does not invent weather it was given no place for", () => {
    const text = briefingToText(bare);
    expect(text).not.toMatch(/°/);
    expect(text).toMatch(/не знает, где он|город не указан/i);
  });

  it("says the date whatever else is missing, because that much is always known", () => {
    expect(briefingToText(bare)).toContain("31 августа");
  });
});

describe("what a full morning reads as", () => {
  const full: Briefing = {
    date: "понедельник, 31 августа",
    weather: "Киев: 21°C, ясно, сегодня от 14°C до 26°C",
    events: [
      { start: new Date(2026, 7, 31, 9, 0), allDay: false, summary: "Планёрка" },
      { start: new Date(2026, 7, 31, 0, 0), allDay: true, summary: "Отпуск Веры" },
    ],
    notes: [{ path: "Заметки/План.md", title: "План", excerpt: "закрыть жесты", score: 10 }],
    tasks: [{ note: "Дубистэй", text: "подготовить оффер" }],
  };

  it("carries every part he asked for", () => {
    const text = briefingToText(full);
    expect(text).toContain("31 августа");
    expect(text).toContain("21°C");
    expect(text).toContain("Планёрка");
    expect(text).toContain("План");
    expect(text).toContain("подготовить оффер");
  });

  it("gives a timed event its time and an all-day one none", () => {
    const text = briefingToText(full);
    expect(text).toMatch(/09:00\s*—?\s*Планёрка/);
    expect(text).not.toMatch(/\d\d:\d\d\s*—?\s*Отпуск Веры/);
  });

  it("stays short enough to be spoken", () => {
    // It is read aloud. A briefing the length of a page is one he talks over.
    expect(briefingToText(full).length).toBeLessThan(1200);
  });
});
