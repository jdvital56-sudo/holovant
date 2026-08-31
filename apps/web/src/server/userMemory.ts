import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { brainRoot } from "./brain";

/**
 * What the assistant has concluded about the person it works for.
 *
 * The notes module reads what he wrote. This is the other direction: what the
 * assistant worked out for itself — that he would rather be shown a result
 * than a command to run, that he wants a fix checked in both directions. Those
 * are conclusions, not transcript, and they are the difference between an
 * assistant that has met him and one that meets him again every morning.
 *
 * They live in his own Obsidian vault, as Markdown, because a conclusion he
 * cannot read is one he cannot correct — and a wrong conclusion, unlike a
 * wrong answer, is repeated in every reply from then on. He opens the file,
 * strikes out what is wrong, and the assistant believes him.
 *
 * The front matter matters as much as the text. It marks the file as machine
 * written, which is what keeps it out of a search of his notes: without it the
 * assistant finds its own guess about him and repeats it back as something he
 * decided. See `isAgentMemory` in brain.ts — this is the marker it looks for.
 */

export interface UserFact {
  text: string;
  /** ISO date. Falls back to the file's own age for a line he typed himself. */
  learnedAt: string;
}

/** Beyond this the oldest are dropped: it is a memory, not a log. */
export const MAX_FACTS = 40;
/** Shorter than this is not a conclusion about anyone. */
const MIN_FACT_CHARS = 8;
/**
 * Longer than this is transcript. Everything here is read into the system
 * prompt on every single turn, so length is a cost paid on every answer.
 */
const MAX_FACT_CHARS = 200;

/**
 * Where he is right now, which is a different kind of fact from the rest.
 *
 * He travels, and he says so out loud rather than editing a setting: "я сейчас
 * в Аланье". There is only ever one answer to that, so a new city is a
 * correction and not an addition — a month of travel must not leave four of
 * them in the file with the weather answering for whichever was found first.
 *
 * It is a labelled line in the same file rather than a store of its own, so he
 * reads and corrects it exactly like everything else there.
 */
const PLACE_LABEL = "Город";

/**
 * Labels there is only ever one answer to. A second one is a correction, not
 * an addition — a month of travel must not leave four cities in the file with
 * the weather answering for whichever was found first, and the same goes for
 * what he wants watched in the news.
 */
const SINGLE_VALUED = [PLACE_LABEL, "Темы"] as const;
export type SingleFact = (typeof SINGLE_VALUED)[number];

const prefixOf = (label: string) => `${label}: `;
const startsWithLabel = (text: string, label: string) =>
  text.toLowerCase().startsWith(prefixOf(label).toLowerCase());

const FILE_NAME = "О пользователе.md";
const FOLDER = "Holovant";
const HEADING = "# Что ассистент знает обо мне";

/**
 * Built with String.raw: escapes have twice arrived here mangled by a shell —
 * `\b` as a literal backspace byte — and a pattern that looks right and
 * matches nothing is the worst kind of bug in this file.
 */
const BULLET = new RegExp(String.raw`^-\s+(?:(\d{4}-\d{2}-\d{2})\s*[—–-]\s*)?(.+?)\s*$`);
const NOT_WORD = new RegExp(String.raw`[^\p{L}\p{N}]+`, "gu");

/**
 * The file to keep them in: his vault when he has one, a local file when he
 * has not. Obsidian is his choice, not a requirement of the product — an
 * assistant that only remembers people who use one notes app is not a feature.
 */
export function userMemoryPath(): string {
  const configured = process.env.HOLOVANT_USER_MEMORY_PATH?.trim();
  if (configured) return resolve(configured);
  const vault = brainRoot();
  if (vault) return join(vault, FOLDER, FILE_NAME);
  return resolve(".holovant", FILE_NAME);
}

/** Ignores case, punctuation and spacing, so two wordings of one thought match. */
function normalise(text: string): string {
  return text.toLowerCase().replace(NOT_WORD, " ").trim();
}

async function readRaw(): Promise<{ raw: string; mtime: string }> {
  const path = userMemoryPath();
  try {
    const [raw, info] = await Promise.all([readFile(path, "utf-8"), stat(path)]);
    return { raw, mtime: new Date(info.mtimeMs).toISOString() };
  } catch {
    // Absent is the ordinary case on a first run, and a half-written file after
    // a crash must cost him nothing worse than a forgetful assistant.
    return { raw: "", mtime: new Date().toISOString() };
  }
}

export async function readUserMemory(): Promise<UserFact[]> {
  const { raw, mtime } = await readRaw();
  const facts: UserFact[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const match = BULLET.exec(line);
    if (!match) continue;
    const text = match[2].trim();
    if (!text) continue;
    facts.push({ text, learnedAt: match[1] ? new Date(match[1]).toISOString() : mtime });
  }
  return facts;
}

/**
 * Rewrites the file, keeping every line that is not one of the conclusions.
 *
 * He opens this in Obsidian and writes in it. A paragraph of his own above the
 * list must still be there afterwards, or the next thing the assistant learns
 * costs him something he wrote.
 */
async function writeUserMemory(facts: UserFact[]): Promise<void> {
  const path = userMemoryPath();
  const { raw } = await readRaw();

  const kept = raw
    ? raw.split(/\r?\n/).filter((line) => !BULLET.test(line))
    : ["---", "type: user", "source: holovant", "---", "", HEADING, ""];

  const body = [...kept, ...facts.map((f) => `- ${f.learnedAt.slice(0, 10)} — ${f.text}`), ""];
  // Collapses the run of blank lines left where the old list stood.
  const text = body.join("\n").replace(/\n{3,}/g, "\n\n");

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text, "utf-8");
}

export interface RememberResult {
  stored: boolean;
  /** Plain enough for the model to say out loud. */
  reason: string;
}

/**
 * Records one conclusion, if it is one.
 *
 * The judgement of what is worth concluding belongs to the model and its
 * brief. What is enforced here is only what can be checked: that it is the
 * size of a conclusion, and that the same thought is not written twice in two
 * wordings — a memory that accumulates paraphrases of one fact ends up
 * insisting on it.
 */
export async function rememberAboutUser(fact: string): Promise<RememberResult> {
  const text = fact.trim().replace(/\s+/g, " ");
  // The model has two ways to record these and only one of them is the tool
  // for it. Both must replace the old one, or the wrong door leaves two.
  const labelled = SINGLE_VALUED.find((label) => startsWithLabel(text, label));
  if (labelled) return setSingleFact(labelled, text.slice(prefixOf(labelled).length));
  if (text.length < MIN_FACT_CHARS) return { stored: false, reason: "Too short to be a conclusion." };
  if (text.length > MAX_FACT_CHARS) {
    return { stored: false, reason: "Too long — a conclusion, not a retelling of what was said." };
  }

  const facts = await readUserMemory();
  const incoming = normalise(text);

  for (let i = 0; i < facts.length; i++) {
    const existing = normalise(facts[i].text);
    if (existing === incoming) return { stored: false, reason: "Already known." };
    // Known in more detail already: the sharper wording is the one to keep.
    if (existing.includes(incoming)) return { stored: false, reason: "Already known, in more detail." };
    // The sharper wording has just arrived: it supersedes rather than joins.
    if (incoming.includes(existing)) {
      facts[i] = { text, learnedAt: new Date().toISOString() };
      await writeUserMemory(facts);
      return { stored: true, reason: "Refined what was known." };
    }
  }

  facts.push({ text, learnedAt: new Date().toISOString() });
  await writeUserMemory(facts.slice(-MAX_FACTS));
  return { stored: true, reason: "Noted." };
}

/** Records one of the single-valued facts, replacing whatever it said before. */
export async function setSingleFact(label: SingleFact, value: string): Promise<RememberResult> {
  const text = value.trim().replace(/\s+/g, " ");
  if (!text) return { stored: false, reason: `No ${label.toLowerCase()} was given.` };

  const facts = (await readUserMemory()).filter((fact) => !startsWithLabel(fact.text, label));
  facts.push({ text: `${prefixOf(label)}${text}`, learnedAt: new Date().toISOString() });
  await writeUserMemory(facts.slice(-MAX_FACTS));
  return { stored: true, reason: `${label}: ${text}.` };
}

/** The last value of one, or null. Never guessed — only what he said. */
export async function getSingleFact(label: SingleFact): Promise<string | null> {
  const facts = await readUserMemory();
  const line = [...facts].reverse().find((fact) => startsWithLabel(fact.text, label));
  return line ? line.text.slice(prefixOf(label).length).trim() || null : null;
}

/**
 * Where he is now. He travels and says so out loud rather than editing a
 * setting, and the weather and the briefing follow it without asking again.
 */
export const setUserPlace = (place: string) => setSingleFact(PLACE_LABEL, place);
export const getUserPlace = () => getSingleFact(PLACE_LABEL);

/** What he wants watched in the news, as he phrased it. */
export const setNewsTopics = (topics: string) => setSingleFact("Темы", topics);
export const getNewsTopics = () => getSingleFact("Темы");

export interface ForgetResult {
  /** The conclusion that was removed, or null when there was no such thing. */
  removed: string | null;
  clearedAll: boolean;
}

/**
 * Drops one conclusion, named approximately, or all of them.
 *
 * He will not quote it back word for word; he will say "забудь про терминал".
 * Reporting a deletion that did not happen is the same lie as reporting an
 * action that did not happen, so a miss is reported as a miss.
 */
export async function forgetAboutUser(query: string | null): Promise<ForgetResult> {
  const facts = await readUserMemory();

  if (query === null) {
    await writeUserMemory([]);
    return { removed: null, clearedAll: true };
  }

  const wanted = normalise(query);
  if (!wanted) return { removed: null, clearedAll: false };

  const index = facts.findIndex((f) => normalise(f.text).includes(wanted));
  if (index === -1) return { removed: null, clearedAll: false };

  const [removed] = facts.splice(index, 1);
  await writeUserMemory(facts);
  return { removed: removed.text, clearedAll: false };
}

/**
 * What the model is told about him, or nothing at all.
 *
 * Null rather than an empty heading: a heading saying nothing is known is an
 * invitation to invent something.
 */
export function summariseForPrompt(facts: UserFact[]): string | null {
  if (!facts.length) return null;
  return facts.map((f) => `- ${f.text}`).join("\n");
}
