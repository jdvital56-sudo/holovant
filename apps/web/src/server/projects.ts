import { execFile } from "node:child_process";
import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { pluralRu } from "@/voice/russianNumbers";

const run = promisify(execFile);

/**
 * His projects, as the machine actually holds them: the repositories he works
 * in, with the state he left each one in.
 *
 * The card used to say five active projects and "Holovant" to everyone. His
 * notes were the obvious next guess and the wrong one — the whole vault has a
 * single file with unticked boxes in it, and that file is a template. What he
 * really has four of is repositories, and each one carries its own honest
 * answer to "where did I leave this": the branch, when it last moved, and how
 * much is sitting uncommitted.
 */

export interface ProjectRepo {
  name: string;
  branch: string | null;
  /** Seconds since the last commit, or null if the repository has none yet. */
  ageSeconds: number | null;
  /** Files changed and not committed, or null when git would not answer. */
  uncommitted: number | null;
}

/** A repository is scanned no more often than this; git is not free. */
const CACHE_MS = 60_000;
const GIT_TIMEOUT_MS = 5000;
const MAX_REPOS = 8;

let cached: { at: number; root: string; repos: ProjectRepo[] } | null = null;

export function projectsRoot(): string | null {
  const configured = process.env.HOLOVANT_PROJECTS_PATH?.trim();
  return configured ? resolve(configured) : null;
}

export function areProjectsConnected(): boolean {
  return projectsRoot() !== null;
}

/**
 * How long ago, in words a synthesiser can read.
 *
 * Russian agrees with the number, so "3 дня" and "5 дней" are not the same
 * word — writing "5 дня" is the difference between a product and a toy, which
 * is the whole reason `pluralRu` exists.
 */
export function describeAge(seconds: number | null): string {
  if (seconds === null) return "коммитов нет";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} ${pluralRu(minutes, ["минуту", "минуты", "минут"])} назад`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${pluralRu(hours, ["час", "часа", "часов"])} назад`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ${pluralRu(days, ["день", "дня", "дней"])} назад`;

  const months = Math.floor(days / 30);
  return `${months} ${pluralRu(months, ["месяц", "месяца", "месяцев"])} назад`;
}

async function git(directory: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await run("git", ["-C", directory, ...args], { timeout: GIT_TIMEOUT_MS });
    return stdout.trim();
  } catch {
    // A directory that is not a repository, or a git that is not installed.
    // Either is a reason to say nothing about this one, not to fail the card.
    return null;
  }
}

async function readRepo(root: string, name: string): Promise<ProjectRepo | null> {
  const directory = join(root, name);
  const branch = await git(directory, ["branch", "--show-current"]);
  if (branch === null) return null;

  const [committedAt, status] = await Promise.all([
    git(directory, ["log", "-1", "--format=%ct"]),
    git(directory, ["status", "--porcelain"]),
  ]);

  const seconds = committedAt ? Math.max(0, Math.floor(Date.now() / 1000) - Number(committedAt)) : null;
  return {
    name,
    branch: branch || null,
    ageSeconds: Number.isFinite(seconds) ? seconds : null,
    uncommitted: status === null ? null : status ? status.split(/\r?\n/).length : 0,
  };
}

/**
 * Every repository directly under the configured folder.
 *
 * @returns null when no folder is configured — which the card says, rather
 *   than showing an empty list that reads as "you have no projects"
 */
export async function listProjects(): Promise<ProjectRepo[] | null> {
  const root = projectsRoot();
  if (!root) return null;

  if (cached && cached.root === root && Date.now() - cached.at < CACHE_MS) return cached.repos;

  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return null;
  }

  const names = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .slice(0, MAX_REPOS);

  const repos = (await Promise.all(names.map((name) => readRepo(root, name)))).filter(
    (repo): repo is ProjectRepo => repo !== null,
  );

  // Most recently touched first: the question a glance at this card asks is
  // "what was I in the middle of".
  repos.sort((a, b) => (a.ageSeconds ?? Infinity) - (b.ageSeconds ?? Infinity));
  cached = { at: Date.now(), root, repos };
  return repos;
}
