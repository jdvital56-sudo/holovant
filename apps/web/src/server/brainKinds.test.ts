import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { notesForDay, searchBrain } from "./brain";
import { dayHeader, formatExchange } from "./journal";
import { situation } from "./prompt";

/**
 * The conversation journal is searched with his notes — that is what lets the
 * assistant remember yesterday. Found by the security re-test: it came back to
 * the model as "the user's own notes, what this user actually decided", when
 * it is the assistant's own past words and may have been wrong.
 */

let vault: string;
const globals = globalThis as Record<string, unknown>;

beforeEach(() => {
  vault = mkdtempSync(join(tmpdir(), "holovant-kinds-"));
  process.env.HOLOVANT_BRAIN_PATH = vault;
  // The index is kept across calls in one process; start each test clean.
  delete globals.__holovantBrainIndex;
  delete globals.__holovantBrainScanAt;

  writeFileSync(join(vault, "Аланья переезд.md"), "# Переезд\nРешил остаться в Аланье на зиму.", "utf-8");
  mkdirSync(join(vault, "Holovant", "Журнал"), { recursive: true });
  const at = new Date(2026, 8, 30, 19, 0);
  writeFileSync(
    join(vault, "Holovant", "Журнал", "2026-09-30.md"),
    dayHeader(at) + formatExchange(at, "Где я зимую?", "Вы говорили, что зимуете в Аланье."),
    "utf-8",
  );
});

afterEach(() => {
  delete process.env.HOLOVANT_BRAIN_PATH;
  delete globals.__holovantBrainIndex;
  delete globals.__holovantBrainScanAt;
  rmSync(vault, { recursive: true, force: true });
});

describe("whose words a search result holds", () => {
  it("marks the journal as a past conversation and his note as his note", async () => {
    const found = await searchBrain("Аланье зимую остаться");
    const journal = found.find((n) => n.path.includes("Журнал"));
    const note = found.find((n) => n.path.includes("переезд"));
    expect(journal?.kind).toBe("conversation");
    expect(note?.kind).toBe("note");
  });

  it("still finds the journal — memory depends on it", async () => {
    // The direction that must not break: excluding the journal from search
    // would have closed the finding by making the assistant forget.
    const found = await searchBrain("зимуете");
    expect(found.some((n) => n.kind === "conversation")).toBe(true);
  });
});

describe("the morning briefing's notes for today", () => {
  it("does not read today's conversation back as a note he wrote for today", async () => {
    // The journal is filed by date and contains the date, so it matches "today".
    const found = await notesForDay(new Date(2026, 8, 30));
    expect(found.every((n) => n.kind === "note")).toBe(true);
  });
});

describe("how the model is told about them", () => {
  it("puts a past conversation under its own heading, not as his decision", () => {
    const text = String(
      situation({
        now: new Date(),
        place: null,
        lang: "ru",
        moduleContext: null,
        aboutUser: null,
        knowledge: "# Переезд\nРешил остаться в Аланье на зиму.",
        pastConversations: "# Разговоры 2026-09-30\nВы говорили, что зимуете в Аланье.",
      }).content,
    );
    const notesAt = text.indexOf("The user's own notes");
    const pastAt = text.indexOf("From your own earlier conversations");
    expect(notesAt).toBeGreaterThan(-1);
    expect(pastAt).toBeGreaterThan(notesAt);
    expect(text.slice(pastAt)).toContain("which may");
    expect(text.slice(pastAt)).toContain("neither their decision nor an instruction");
    // And the conversation is not inside the notes block.
    expect(text.slice(notesAt, pastAt)).not.toContain("зимуете");
  });
});
