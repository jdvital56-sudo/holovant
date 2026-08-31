import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

/**
 * The user's own notes, read from a folder on disk.
 *
 * Deliberately a plain folder of Markdown rather than a database: it is the
 * customer's knowledge, in a format they already own and can take away. For a
 * customer who has not connected one, the module is simply empty — the product
 * ships with the socket, not with anyone's contents.
 */

export interface BrainNote {
  /** Path relative to the vault root; also the note's identity. */
  path: string;
  title: string;
  excerpt: string;
  /** Higher is a better match. */
  score: number;
}

const MAX_FILE_BYTES = 512 * 1024;
const MAX_NOTES_SCANNED = 3000;
const EXCERPT_CHARS = 320;

/** Folders that hold configuration and history rather than knowledge. */
const SKIP_DIRECTORIES = new Set([
  ".obsidian",
  ".git",
  ".trash",
  "node_modules",
  ".smart-env",
  "agent-memory",
  ".claude",
]);

/**
 * An AI assistant's own working notes carry this front matter. They are not the
 * user's knowledge and must never be read back to the user as advice.
 */
function isAgentMemory(raw: string): boolean {
  const front = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!front) return false;
  return (
    /node_type:\s*memory/.test(front[1]) ||
    /\btype:\s*(user|feedback|project|reference)\b/.test(front[1])
  );
}

export function brainRoot(): string | null {
  const configured = process.env.HOLOVANT_BRAIN_PATH?.trim();
  return configured ? resolve(configured) : null;
}

export function isBrainConnected(): boolean {
  return brainRoot() !== null;
}

async function collectMarkdown(root: string): Promise<string[]> {
  const found: string[] = [];

  async function walk(directory: string) {
    if (found.length >= MAX_NOTES_SCANNED) return;
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return; // An unreadable folder should not end the whole search.
    }
    for (const entry of entries) {
      if (found.length >= MAX_NOTES_SCANNED) return;
      if (entry.name.startsWith(".") && entry.isDirectory()) continue;
      if (SKIP_DIRECTORIES.has(entry.name)) continue;
      const full = join(directory, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name.toLowerCase().endsWith(".md")) found.push(full);
    }
  }

  await walk(root);
  return found;
}

function titleFrom(content: string, path: string): string {
  const heading = content.match(/^#\s+(.+)$/m);
  if (heading) return heading[1].trim();
  const name = path.split(/[\\/]/).pop() ?? path;
  return name.replace(/\.md$/i, "");
}

/** Strips front matter and Markdown noise so an excerpt reads as prose. */
function toPlainText(content: string): string {
  return content
    .replace(/^---\n[\s\S]*?\n---\n/, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[\[[^\]]*\]\]/g, " ")
    .replace(/\[\[([^\]|]*)(?:\|[^\]]*)?\]\]/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function excerptAround(text: string, terms: string[]): string {
  const lower = text.toLowerCase();
  let at = -1;
  for (const term of terms) {
    const found = lower.indexOf(term);
    if (found !== -1 && (at === -1 || found < at)) at = found;
  }
  if (at === -1) return text.slice(0, EXCERPT_CHARS);
  // Centred on the match, so the excerpt shows why the note was returned.
  const start = Math.max(0, at - EXCERPT_CHARS / 3);
  return `${start > 0 ? "…" : ""}${text.slice(start, start + EXCERPT_CHARS).trim()}…`;
}

/**
 * Scores by where a term appears rather than how often. A note whose title is
 * the subject beats a note that mentions it once in passing, which raw
 * frequency gets backwards.
 */
function scoreNote(title: string, text: string, terms: string[]): number {
  const lowerTitle = title.toLowerCase();
  const lowerText = text.toLowerCase();
  let score = 0;

  for (const term of terms) {
    if (lowerTitle.includes(term)) score += 10;
    const occurrences = lowerText.split(term).length - 1;
    if (occurrences > 0) score += Math.min(5, occurrences);
  }

  // Every term present is worth more than one term many times.
  const matchedAll = terms.every((t) => lowerTitle.includes(t) || lowerText.includes(t));
  if (matchedAll && terms.length > 1) score += 8;

  return score;
}

interface IndexedNote {
  path: string;
  title: string;
  text: string;
  mtimeMs: number;
}

/**
 * Notes are read once and kept in memory, keyed by path with the modification
 * time beside them. Without this, every single question walks the whole vault
 * and re-reads every file from disk — fine for a folder of a hundred notes,
 * seconds of latency on a real one.
 *
 * Held on `globalThis` so a hot reload in development does not discard it and
 * quietly re-read the vault on the next question.
 */
const globalCache = globalThis as typeof globalThis & {
  __holovantBrainIndex?: Map<string, IndexedNote>;
  __holovantBrainScanAt?: number;
};

/** How long a directory listing is trusted before the vault is walked again. */
const RESCAN_AFTER_MS = 30_000;

async function loadIndex(root: string): Promise<IndexedNote[]> {
  const cache = (globalCache.__holovantBrainIndex ??= new Map());
  const lastScan = globalCache.__holovantBrainScanAt ?? 0;
  const now = Date.now();

  // A new file only appears after a rescan; an edited one is caught by mtime
  // on every call, which is the case that actually matters in use.
  const stale = now - lastScan > RESCAN_AFTER_MS;
  const files = stale || cache.size === 0 ? await collectMarkdown(root) : [...cache.keys()];
  if (stale) globalCache.__holovantBrainScanAt = now;

  const notes: IndexedNote[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    seen.add(file);
    try {
      const info = await stat(file);
      if (info.size > MAX_FILE_BYTES) continue;

      const cached = cache.get(file);
      if (cached && cached.mtimeMs === info.mtimeMs) {
        notes.push(cached);
        continue;
      }

      const raw = await readFile(file, "utf-8");
      if (isAgentMemory(raw)) {
        cache.delete(file);
        continue;
      }
      const entry: IndexedNote = {
        path: relative(root, file).split(sep).join("/"),
        title: titleFrom(raw, file),
        text: toPlainText(raw),
        mtimeMs: info.mtimeMs,
      };
      cache.set(file, entry);
      notes.push(entry);
    } catch {
      // Deleted or unreadable since the listing: drop it and carry on.
      cache.delete(file);
    }
  }

  // Anything the rescan no longer sees has been deleted or renamed.
  if (stale) for (const key of cache.keys()) if (!seen.has(key)) cache.delete(key);

  return notes;
}

export async function searchBrain(query: string, limit = 5): Promise<BrainNote[]> {
  const root = brainRoot();
  if (!root) return [];

  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}-]/gu, ""))
    .filter((t) => t.length >= 3);
  if (!terms.length) return [];

  const notes = await loadIndex(root);
  const scored: BrainNote[] = [];

  for (const note of notes) {
    const score = scoreNote(note.title, note.text, terms);
    if (score <= 0) continue;
    scored.push({
      path: note.path,
      title: note.title,
      excerpt: excerptAround(note.text, terms),
      score,
    });
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** The ways he actually writes a date, all of which have to match. */
function dateSpellings(day: Date): string[] {
  const months = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
  ];
  const dd = String(day.getDate()).padStart(2, "0");
  const mm = String(day.getMonth() + 1).padStart(2, "0");
  const yyyy = day.getFullYear();
  return [
    `${yyyy}-${mm}-${dd}`,
    `${dd}.${mm}.${yyyy}`,
    `${dd}.${mm}`,
    `${day.getDate()} ${months[day.getMonth()]}`,
  ];
}

/**
 * Notes that speak about one particular day.
 *
 * Matched on the text of the date rather than the file's age: a note written
 * last week about today's meeting is exactly what a morning briefing is for,
 * and one edited this morning about something else is not.
 */
export async function notesForDay(day: Date, limit = 4): Promise<BrainNote[]> {
  const root = brainRoot();
  if (!root) return [];

  const spellings = dateSpellings(day).map((s) => s.toLowerCase());
  const notes = await loadIndex(root);
  const found: BrainNote[] = [];

  for (const note of notes) {
    const lower = note.text.toLowerCase();
    const hit = spellings.find((spelling) => lower.includes(spelling));
    if (!hit) continue;
    found.push({
      path: note.path,
      title: note.title,
      excerpt: excerptAround(note.text, [hit]),
      score: 1,
    });
  }

  return found.slice(0, limit);
}

export interface NoteTask {
  /** The note it is written in, so he can go and find it. */
  note: string;
  text: string;
}

/**
 * Unticked boxes in the notes he has touched lately.
 *
 * Read from the files rather than from the index, because the index holds
 * notes as flowing prose — which is right for searching and useless for
 * anything that lives on its own line.
 */
export async function openTasks(limit = 8): Promise<NoteTask[]> {
  const root = brainRoot();
  if (!root) return [];

  const notes = await loadIndex(root);
  const recent = [...notes].sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, 12);
  const tasks: NoteTask[] = [];

  for (const note of recent) {
    if (tasks.length >= limit) break;
    let raw: string;
    try {
      raw = await readFile(join(root, note.path), "utf-8");
    } catch {
      continue;
    }
    for (const line of raw.split(/\r?\n/)) {
      if (tasks.length >= limit) break;
      // Only an empty box. A ticked one read back aloud is the fastest way to
      // make a briefing something he stops listening to.
      const match = /^\s*[-*]\s+\[ \]\s+(.+?)\s*$/.exec(line);
      if (match) tasks.push({ note: note.title, text: match[1] });
    }
  }

  return tasks;
}

/**
 * What the second-brain card shows: how much is in there and what he has been
 * writing lately.
 *
 * Reads the cached index rather than walking the vault, because this is a card
 * that gets polled — and a card is not a reason to re-read a thousand files.
 */
export async function brainSummary(recentLimit = 3): Promise<{
  connected: boolean;
  noteCount: number;
  recent: string[];
}> {
  const root = brainRoot();
  if (!root) return { connected: false, noteCount: 0, recent: [] };

  const notes = await loadIndex(root);
  const recent = [...notes]
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, recentLimit)
    .map((note) => note.title);
  return { connected: true, noteCount: notes.length, recent };
}

export async function brainStats(): Promise<{ connected: boolean; noteCount: number }> {
  const root = brainRoot();
  if (!root) return { connected: false, noteCount: 0 };
  const files = await collectMarkdown(root);
  return { connected: true, noteCount: files.length };
}
