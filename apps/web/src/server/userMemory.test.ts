import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { searchBrain } from "@/server/brain";
import {
  forgetAboutUser,
  getUserPlace,
  setUserPlace,
  readUserMemory,
  rememberAboutUser,
  summariseForPrompt,
  userMemoryPath,
  MAX_FACTS,
} from "@/server/userMemory";

/**
 * What the assistant concludes about the person it works for.
 *
 * Not notes — those are his own, in his own vault, and it only ever reads
 * them. These are its own conclusions, which is what makes them dangerous: a
 * wrong one, once written, is repeated in every answer forever, and nobody
 * proof-reads a file they did not know existed. So they are written into his
 * Obsidian vault as Markdown he can open, read and correct, and not into a
 * private store he would have to take on trust.
 *
 * Both directions are here. A memory that writes too eagerly fills with
 * transcript — "asked about the weather" — and poisons every prompt; one that
 * writes too rarely never learns and the feature is decoration. The
 * conclusions below are real ones from working with him, not invented
 * examples, because invented examples agree with whatever I already believe.
 */

let vault: string;

beforeEach(async () => {
  vault = await mkdtemp(join(tmpdir(), "holovant-vault-"));
  process.env.HOLOVANT_BRAIN_PATH = vault;
  delete process.env.HOLOVANT_USER_MEMORY_PATH;
  // The note index is cached on globalThis and rescans on a timer, so without
  // this a test would search the previous test's vault and pass or fail for
  // reasons that have nothing to do with it.
  const cache = globalThis as Record<string, unknown>;
  delete cache.__holovantBrainIndex;
  delete cache.__holovantBrainScanAt;
});

afterEach(() => {
  delete process.env.HOLOVANT_BRAIN_PATH;
  delete process.env.HOLOVANT_USER_MEMORY_PATH;
});

describe("where the conclusions live", () => {
  it("writes them into his own vault, where he can read them", async () => {
    // His second brain, not a hidden file. A conclusion he cannot see is one
    // he cannot correct.
    expect(userMemoryPath().startsWith(vault)).toBe(true);
    expect(userMemoryPath()).toMatch(/\.md$/);
  });

  it("writes Markdown a person can edit, not a machine format", async () => {
    await rememberAboutUser("Терминал ему тяжёл — лучше делать самому и показывать результат");
    const raw = await readFile(userMemoryPath(), "utf-8");
    expect(raw).toMatch(/^---/);
    expect(raw).toContain("- ");
    expect(raw).toContain("Терминал");
  });

  it("still works for someone who has no vault connected", async () => {
    // Obsidian is his choice, not a requirement of the product.
    delete process.env.HOLOVANT_BRAIN_PATH;
    process.env.HOLOVANT_USER_MEMORY_PATH = join(vault, "elsewhere", "about-user.md");
    const result = await rememberAboutUser("Работает над несколькими бизнесами, Nexus OS в приоритете");
    expect(result.stored).toBe(true);
    expect(await readUserMemory()).toHaveLength(1);
  });
});

describe("the circle it must not close", () => {
  it("never comes back out of a search of his notes", async () => {
    // The trap this file invents: the assistant writes a guess about him into
    // the vault, then finds it while searching his notes and repeats it back
    // as something he decided. Its own conclusions must be invisible to that
    // search — the vault already marks machine-written notes for exactly this.
    await rememberAboutUser("Терминал ему тяжёл — лучше делать самому и показывать результат");
    const found = await searchBrain("терминал тяжёл");
    expect(found).toEqual([]);
  });

  it("still finds his own notes on the same subject", async () => {
    // The other direction: hiding its own conclusions must not hide his notes.
    await mkdir(join(vault, "Заметки"), { recursive: true });
    await writeFile(
      join(vault, "Заметки", "Терминал.md"),
      "# Терминал\nЗдесь мои собственные мысли про терминал и как я с ним работаю.",
      "utf-8",
    );
    await rememberAboutUser("Терминал ему тяжёл — лучше делать самому и показывать результат");
    const found = await searchBrain("терминал");
    expect(found).toHaveLength(1);
    expect(found[0].title).toBe("Терминал");
  });
});

describe("what it must learn", () => {
  it("keeps a conclusion and gives it back", async () => {
    await rememberAboutUser("Терминал ему тяжёл — лучше делать самому и показывать результат");
    const facts = await readUserMemory();
    expect(facts).toHaveLength(1);
    expect(facts[0].text).toContain("Терминал");
  });

  it("records when it learned something, so an old conclusion can be told from a fresh one", async () => {
    await rememberAboutUser("Не хочет, чтобы система заговаривала первой");
    const [fact] = await readUserMemory();
    expect(Date.parse(fact.learnedAt)).toBeGreaterThan(0);
  });

  it("takes several different conclusions", async () => {
    await rememberAboutUser("Терминал ему тяжёл, лучше делать самому");
    await rememberAboutUser("Просит чинить в обе стороны, с таблицей в тесте");
    await rememberAboutUser("Не хочет, чтобы система заговаривала первой");
    expect(await readUserMemory()).toHaveLength(3);
  });

  it("puts what it knows where the model will read it", async () => {
    await rememberAboutUser("Терминал ему тяжёл, лучше делать самому");
    const summary = summariseForPrompt(await readUserMemory());
    expect(summary).toContain("Терминал");
  });

  it("says nothing at all when it has concluded nothing", async () => {
    // An empty heading announcing that nothing is known is worse than silence:
    // it invites the model to fill it.
    expect(summariseForPrompt([])).toBeNull();
  });
});

describe("what it must refuse to learn", () => {
  it("refuses a fragment too short to be a conclusion", async () => {
    for (const noise of ["", "он", "да", "ок"]) {
      const result = await rememberAboutUser(noise);
      expect(result.stored, noise).toBe(false);
    }
    expect(await readUserMemory()).toHaveLength(0);
  });

  it("refuses a whole paragraph, which is transcript rather than conclusion", async () => {
    // Everything here is read into the system prompt on every single turn. A
    // page of text does not become a conclusion by being about someone.
    const result = await rememberAboutUser("Он сказал, что ".repeat(60));
    expect(result.stored).toBe(false);
    expect(await readUserMemory()).toHaveLength(0);
  });

  it("does not write the same conclusion twice", async () => {
    await rememberAboutUser("Терминал ему тяжёл, лучше делать самому");
    await rememberAboutUser("терминал ему тяжёл, лучше делать самому!");
    expect(await readUserMemory()).toHaveLength(1);
  });

  it("does not store a conclusion it already knows in more detail", async () => {
    await rememberAboutUser("Предпочитает короткие ответы, две-три фразы");
    const second = await rememberAboutUser("Предпочитает короткие ответы");
    expect(second.stored).toBe(false);
    const facts = await readUserMemory();
    expect(facts).toHaveLength(1);
    expect(facts[0].text).toContain("две-три фразы");
  });

  it("replaces a conclusion when it learns the sharper version of it", async () => {
    // The other direction of the same rule, and the one that matters more: a
    // refinement must not be thrown away as a duplicate.
    await rememberAboutUser("Предпочитает короткие ответы");
    await rememberAboutUser("Предпочитает короткие ответы, две-три фразы");
    const facts = await readUserMemory();
    expect(facts).toHaveLength(1);
    expect(facts[0].text).toContain("две-три фразы");
  });

  it("never grows without limit, and drops the oldest first", async () => {
    for (let i = 0; i < MAX_FACTS + 5; i++) {
      await rememberAboutUser(`Вывод номер ${i} про то, как он работает`);
    }
    const facts = await readUserMemory();
    expect(facts).toHaveLength(MAX_FACTS);
    expect(facts[0].text).toContain("номер 5 ");
    expect(facts.at(-1)!.text).toContain(`номер ${MAX_FACTS + 4} `);
  });
});

describe("what it must be able to unlearn", () => {
  it("forgets a conclusion named approximately", async () => {
    // He will not quote it back word for word. He will say "забудь про
    // терминал", and that has to be enough.
    await rememberAboutUser("Терминал ему тяжёл, лучше делать самому");
    await rememberAboutUser("Не хочет, чтобы система заговаривала первой");
    const result = await forgetAboutUser("терминал");
    expect(result.removed).toContain("Терминал");
    const left = await readUserMemory();
    expect(left).toHaveLength(1);
    expect(left[0].text).toContain("заговаривала");
  });

  it("says plainly when there was nothing of the sort to forget", async () => {
    // Reporting a deletion that did not happen is the same lie as reporting an
    // action that did not happen.
    await rememberAboutUser("Терминал ему тяжёл, лучше делать самому");
    const result = await forgetAboutUser("кофе");
    expect(result.removed).toBeNull();
    expect(await readUserMemory()).toHaveLength(1);
  });

  it("forgets everything when asked for everything", async () => {
    await rememberAboutUser("Терминал ему тяжёл, лучше делать самому");
    await rememberAboutUser("Не хочет, чтобы система заговаривала первой");
    await forgetAboutUser(null);
    expect(await readUserMemory()).toHaveLength(0);
  });
});

describe("what must not take the assistant down with it", () => {
  it("reads an absent memory as an empty one, not as a failure", async () => {
    // The file does not exist until something is concluded. Chat must work on
    // the first run, before there is anything to know.
    expect(await readUserMemory()).toEqual([]);
  });

  it("keeps what he wrote by hand, in the order he left it", async () => {
    // He opens this file in Obsidian. Dates he deletes, wording he changes,
    // lines he adds himself — all of it has to survive being read back.
    await mkdir(dirname(userMemoryPath()), { recursive: true });
    await writeFile(
      userMemoryPath(),
      [
        "---",
        "type: user",
        "---",
        "",
        "# Что Тор знает обо мне",
        "",
        "Всякий текст, который я тут написал сам.",
        "",
        "- Терминал мне тяжёл, делай сам",
        "- 2026-08-31 — Не хочет, чтобы система заговаривала первой",
        "",
      ].join("\n"),
      "utf-8",
    );
    const facts = await readUserMemory();
    expect(facts.map((f) => f.text)).toEqual([
      "Терминал мне тяжёл, делай сам",
      "Не хочет, чтобы система заговаривала первой",
    ]);
    expect(Date.parse(facts[0].learnedAt)).toBeGreaterThan(0);
  });

  it("does not lose his prose when it writes a new conclusion", async () => {
    // Rewriting the file must not quietly delete the paragraph he added.
    await mkdir(dirname(userMemoryPath()), { recursive: true });
    await writeFile(
      userMemoryPath(),
      ["---", "type: user", "---", "", "Мои собственные пометки сверху.", "", "- Терминал мне тяжёл", ""].join("\n"),
      "utf-8",
    );
    await rememberAboutUser("Не хочет, чтобы система заговаривала первой");
    const raw = await readFile(userMemoryPath(), "utf-8");
    expect(raw).toContain("Мои собственные пометки сверху.");
    expect(raw).toContain("Терминал мне тяжёл");
    expect(raw).toContain("заговаривала");
  });
});

describe("where he is right now", () => {
  /**
   * He travels, and he will say so out loud rather than editing a setting:
   * "я сейчас в Аланье". That makes the place a different kind of fact from
   * the rest — there is only ever one of it, and the new one is not an
   * addition but a correction.
   */

  it("keeps the city he named", async () => {
    await setUserPlace("Аланья, Турция");
    expect(await getUserPlace()).toBe("Аланья, Турция");
  });

  it("replaces it when he moves, instead of remembering both", async () => {
    // The failure this is built against: a month of travel leaving four
    // cities in the file and the weather answering for whichever was found
    // first. There is one answer to "where are you", and it is the last one.
    await setUserPlace("Аланья, Турция");
    await setUserPlace("Стамбул");
    expect(await getUserPlace()).toBe("Стамбул");
    const facts = await readUserMemory();
    expect(facts.filter((f) => f.text.startsWith("Город"))).toHaveLength(1);
  });

  it("writes it as a line he can read and correct like any other", async () => {
    await setUserPlace("Аланья, Турция");
    const [fact] = await readUserMemory();
    expect(fact.text).toBe("Город: Аланья, Турция");
  });

  it("replaces it even when the model records it as an ordinary conclusion", async () => {
    // The model has two ways to say this and only one of them is the tool.
    await setUserPlace("Аланья, Турция");
    await rememberAboutUser("Город: Анталья");
    expect(await getUserPlace()).toBe("Анталья");
    expect(await readUserMemory()).toHaveLength(1);
  });

  it("does not touch anything else he is remembered for", async () => {
    // The other direction, and the one a single-valued rule gets wrong: only
    // the city is single. Everything else still accumulates.
    await rememberAboutUser("Терминал ему тяжёл, лучше делать самому");
    await setUserPlace("Аланья, Турция");
    await rememberAboutUser("Не хочет, чтобы система заговаривала первой");
    await setUserPlace("Стамбул");

    const facts = await readUserMemory();
    expect(facts).toHaveLength(3);
    expect(await getUserPlace()).toBe("Стамбул");
    expect(facts.some((f) => f.text.includes("Терминал"))).toBe(true);
    expect(facts.some((f) => f.text.includes("заговаривала"))).toBe(true);
  });

  it("has no city until he names one", async () => {
    // And says so, rather than guessing from a timezone.
    expect(await getUserPlace()).toBeNull();
  });

  it("can be forgotten like anything else", async () => {
    await setUserPlace("Аланья, Турция");
    await forgetAboutUser("город");
    expect(await getUserPlace()).toBeNull();
  });

  it("refuses an empty city rather than remembering a blank", async () => {
    await setUserPlace("Аланья, Турция");
    await setUserPlace("   ");
    expect(await getUserPlace()).toBe("Аланья, Турция");
  });
});
