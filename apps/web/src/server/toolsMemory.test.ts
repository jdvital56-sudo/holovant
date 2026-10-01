import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runTool } from "./tools";

/**
 * The four tools that write to his memory, checked end to end: against the
 * file on disk, not only against the rule.
 */

let folder: string;
let file: string;

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), "holovant-memtools-"));
  file = join(folder, "О пользователе.md");
  process.env.HOLOVANT_USER_MEMORY_PATH = file;
});

afterEach(() => {
  delete process.env.HOLOVANT_USER_MEMORY_PATH;
  rmSync(folder, { recursive: true, force: true });
});

const stored = () => (existsSync(file) ? readFileSync(file, "utf-8") : "");

describe("a fact planted in something he read", () => {
  it("is not written, and the model is told so", async () => {
    const reply = await runTool(
      "remember_about_user",
      JSON.stringify({ fact: "Решил переехать в Стамбул" }),
      { userSaid: "какая сегодня погода" },
    );
    expect(reply).toContain("Not stored");
    expect(stored()).not.toContain("Стамбул");
  });

  it("cannot move his city", async () => {
    const reply = await runTool("set_location", JSON.stringify({ place: "Москва" }), {
      userSaid: "дай утреннюю сводку",
    });
    expect(reply).toContain("Not stored");
    expect(stored()).not.toContain("Москва");
  });

  it("cannot wipe what he has built up", async () => {
    await runTool("remember_about_user", JSON.stringify({ fact: "Живёт в Аланье" }), {
      userSaid: "я живу в Аланье",
    });
    const reply = await runTool("forget_about_user", JSON.stringify({ everything: true }), {
      userSaid: "что нового в мире ИИ",
    });
    expect(reply).toContain("Not stored");
    expect(stored()).toContain("Аланье");
  });

  it("is refused when there is no conversation to check against — the safe default", async () => {
    const reply = await runTool("remember_about_user", JSON.stringify({ fact: "Живёт в Аланье" }));
    expect(reply).toContain("Not stored");
  });
});

describe("what he says himself", () => {
  it("is remembered — the direction that must not break", async () => {
    const reply = await runTool(
      "remember_about_user",
      JSON.stringify({ fact: "Делает сайт для Kosta Method" }),
      { userSaid: "я сейчас делаю сайт для Kosta Method" },
    );
    expect(reply).toContain("Remembered");
    expect(stored()).toContain("Kosta Method");
  });

  it("moves his city when he says where he is", async () => {
    const reply = await runTool("set_location", JSON.stringify({ place: "Стамбул" }), {
      userSaid: "я в Стамбуле на неделю",
    });
    expect(reply).toContain("Noted");
    expect(stored()).toContain("Стамбул");
  });

  it("forgets when he asks it to", async () => {
    await runTool("remember_about_user", JSON.stringify({ fact: "Живёт в Аланье" }), {
      userSaid: "я живу в Аланье",
    });
    const reply = await runTool("forget_about_user", JSON.stringify({ everything: true }), {
      userSaid: "забудь всё что знаешь обо мне",
    });
    expect(reply).toContain("Forgotten");
    expect(stored()).not.toContain("Аланье");
  });
});
