import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { brainRoot } from "./brain";

/**
 * What was actually said, written into his own vault.
 *
 * He asked for a second brain — "чтобы всё, что мы здесь сделали, он
 * запоминал" — and asked whether a GitHub repository would have to be
 * connected. There already is one: his Obsidian vault is a git repository with
 * a remote, and Holovant already searches it. The half that was missing is
 * that nothing ever wrote to it. Everything the assistant said evaporated when
 * the panel closed, which is also what he asked the panel to do.
 *
 * So the two halves are deliberately separate. The panel is the conversation
 * happening now and is wiped when he shuts it. The journal is the record, in
 * Markdown, in his vault, under git, searchable by the same index that reads
 * the rest of his notes — which means the next question can find it without
 * anything else being built.
 *
 * Three rules the shape enforces.
 *
 * **It is his file, not a store.** Plain Markdown he can read, edit or delete
 * in Obsidian. A hidden database that only this program understands would not
 * be a second brain; it would be a cache with a nicer name.
 *
 * **One file a day, appended.** A single growing file would eventually be
 * skipped by the indexer's size limit, and a file per exchange would bury the
 * vault. A day is the unit he thinks in.
 *
 * **Nothing is written that was not said.** No summaries, no conclusions drawn
 * on his behalf — those belong in the facts file, where he can see each one on
 * its own line. This is a transcript.
 */

const FOLDER = "Holovant";
const SUBFOLDER = "Журнал";

/** Long enough to be worth finding again; short enough not to bury the vault. */
export const MAX_QUESTION_CHARS = 400;
export const MAX_ANSWER_CHARS = 1500;

/** Where the day's file lives, or null when there is no vault to write into. */
export function journalPath(day: Date): string | null {
  const configured = process.env.HOLOVANT_JOURNAL_PATH?.trim();
  const root = configured ? resolve(configured) : brainRoot();
  if (!root) return null;
  const folder = configured ? root : join(root, FOLDER, SUBFOLDER);
  return join(folder, `${dayStamp(day)}.md`);
}

/** "2026-09-23", in local time — the day he had, not the day in London. */
export function dayStamp(at: Date): string {
  const month = String(at.getMonth() + 1).padStart(2, "0");
  const day = String(at.getDate()).padStart(2, "0");
  return `${at.getFullYear()}-${month}-${day}`;
}

function clock(at: Date): string {
  return `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
}

/** The front matter a new day's file opens with, so Obsidian treats it as one. */
export function dayHeader(at: Date): string {
  return [
    "---",
    "type: journal",
    "source: holovant",
    `date: ${dayStamp(at)}`,
    "---",
    "",
    `# Разговоры ${dayStamp(at)}`,
    "",
  ].join("\n");
}

/**
 * One exchange, as it will sit in the file.
 *
 * Kept as a pure function so the shape can be checked without a filesystem:
 * a heading per question makes it findable in Obsidian's own search, and the
 * time makes two similar questions on one day tellable apart.
 */
export function formatExchange(at: Date, question: string, answer: string): string {
  const q = question.trim().slice(0, MAX_QUESTION_CHARS);
  const a = answer.trim().slice(0, MAX_ANSWER_CHARS);
  return [`## ${clock(at)} — ${q}`, "", a, "", ""].join("\n");
}

/**
 * Appends one exchange to today's file, creating it if this is the first.
 *
 * @returns the file written to, or null when there was nothing to write or
 *   nowhere to write it. Never throws: a vault that cannot be written to is a
 *   worse journal, not a broken assistant.
 */
export async function recordExchange(
  question: string,
  answer: string,
  at: Date = new Date(),
): Promise<string | null> {
  // An empty half is not an exchange. A failed answer especially: writing
  // "не смог получить ответ" into his second brain would teach it nothing and
  // would come back as a search result later.
  if (!question.trim() || !answer.trim()) return null;

  const path = journalPath(at);
  if (!path) return null;

  try {
    await mkdir(join(path, ".."), { recursive: true });
    // The header goes in only once, when the day's file does not exist yet.
    // Read rather than a flag: another process, or he himself in Obsidian, may
    // have made the file between one exchange and the next.
    let head = "";
    try {
      const existing = await readFile(path, "utf-8");
      if (!existing.trim()) head = dayHeader(at);
    } catch {
      head = dayHeader(at);
    }
    await appendFile(path, head + formatExchange(at, question, answer), "utf-8");
    return path;
  } catch (error) {
    console.error("[journal] could not be written:", error);
    return null;
  }
}
