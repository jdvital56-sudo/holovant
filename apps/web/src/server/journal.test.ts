import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  dayHeader,
  dayStamp,
  formatExchange,
  journalPath,
  recordExchange,
} from "./journal";

/**
 * The record of what was said, in his own vault.
 *
 * The panel is wiped when he closes it — he asked for that. So if nothing
 * writes the exchange down, the assistant genuinely forgets everything the
 * moment he shuts the window, which is the complaint that started this.
 */

let folder: string;

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), "holovant-journal-"));
  process.env.HOLOVANT_JOURNAL_PATH = folder;
});

afterEach(() => {
  delete process.env.HOLOVANT_JOURNAL_PATH;
  rmSync(folder, { recursive: true, force: true });
});

describe("the day a thing was said", () => {
  it("is his day, not the one in London", () => {
    // Written from local parts on purpose: an evening conversation here files
    // itself under tomorrow if the date is taken in UTC.
    const evening = new Date(2026, 8, 23, 23, 40);
    expect(dayStamp(evening)).toBe("2026-09-23");
    expect(dayStamp(new Date(2026, 0, 5, 9, 0))).toBe("2026-01-05");
  });
});

describe("one exchange on the page", () => {
  it("is a heading he can find and the answer underneath it", () => {
    const written = formatExchange(new Date(2026, 8, 23, 18, 5), "какой курс доллара", "48,8 лиры.");
    expect(written).toContain("## 18:05 — какой курс доллара");
    expect(written).toContain("48,8 лиры.");
  });

  it("does not run away with a long answer", () => {
    const written = formatExchange(new Date(), "коротко", "я".repeat(5000));
    expect(written.length).toBeLessThan(2000);
  });
});

describe("writing it down", () => {
  it("makes the day's file, with front matter, on the first exchange", async () => {
    const path = await recordExchange("первый вопрос", "первый ответ", new Date(2026, 8, 23, 10, 0));
    expect(path).not.toBeNull();
    const text = readFileSync(path as string, "utf-8");
    expect(text.startsWith("---")).toBe(true);
    expect(text).toContain("type: journal");
    expect(text).toContain("первый ответ");
  });

  it("adds the second exchange to the same file, keeping the first", async () => {
    // The direction that would be lost by writing rather than appending: a
    // journal that only ever holds the last thing said is not a journal.
    const at = new Date(2026, 8, 23, 10, 0);
    await recordExchange("первый вопрос", "первый ответ", at);
    const path = await recordExchange("второй вопрос", "второй ответ", new Date(2026, 8, 23, 11, 30));
    const text = readFileSync(path as string, "utf-8");
    expect(text).toContain("первый ответ");
    expect(text).toContain("второй ответ");
    // And the front matter exactly once, not once per exchange.
    expect(text.split("type: journal").length - 1).toBe(1);
  });

  it("starts a new file the next day", async () => {
    const first = await recordExchange("вчера", "ответ", new Date(2026, 8, 23, 10, 0));
    const second = await recordExchange("сегодня", "ответ", new Date(2026, 8, 24, 10, 0));
    expect(first).not.toBe(second);
  });

  it("writes nothing when there is nothing to write", async () => {
    // A failed answer must not end up in his second brain, where it would come
    // back as a search result and be treated as something he was told.
    expect(await recordExchange("", "ответ")).toBeNull();
    expect(await recordExchange("вопрос", "")).toBeNull();
    expect(await recordExchange("   ", "   ")).toBeNull();
  });

  it("writes nowhere when no vault is connected", async () => {
    // Not an error: he may have no vault at all, and an assistant that only
    // works for people who use one notes app is not a feature.
    delete process.env.HOLOVANT_JOURNAL_PATH;
    const previous = process.env.HOLOVANT_BRAIN_PATH;
    delete process.env.HOLOVANT_BRAIN_PATH;
    expect(journalPath(new Date())).toBeNull();
    expect(await recordExchange("вопрос", "ответ")).toBeNull();
    if (previous) process.env.HOLOVANT_BRAIN_PATH = previous;
  });

  it("opens the day with a heading Obsidian will show", () => {
    expect(dayHeader(new Date(2026, 8, 23))).toContain("# Разговоры 2026-09-23");
  });
});
