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

export async function searchBrain(query: string, limit = 5): Promise<BrainNote[]> {
  const root = brainRoot();
  if (!root) return [];

  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}-]/gu, ""))
    .filter((t) => t.length >= 3);
  if (!terms.length) return [];

  const files = await collectMarkdown(root);
  const scored: BrainNote[] = [];

  for (const file of files) {
    try {
      const info = await stat(file);
      if (info.size > MAX_FILE_BYTES) continue;
      const raw = await readFile(file, "utf-8");
      if (isAgentMemory(raw)) continue;
      const text = toPlainText(raw);
      const title = titleFrom(raw, file);
      const score = scoreNote(title, text, terms);
      if (score <= 0) continue;
      scored.push({
        path: relative(root, file).split(sep).join("/"),
        title,
        excerpt: excerptAround(text, terms),
        score,
      });
    } catch {
      // One unreadable note must not fail the search.
    }
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

export async function brainStats(): Promise<{ connected: boolean; noteCount: number }> {
  const root = brainRoot();
  if (!root) return { connected: false, noteCount: 0 };
  const files = await collectMarkdown(root);
  return { connected: true, noteCount: files.length };
}
