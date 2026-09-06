/**
 * The football he actually watches: the Turkish Süper Lig, and the European
 * nights the three Istanbul clubs play in.
 *
 * The card in this slot used to read "Arsenal vs Man City, 1 - 1" — a match
 * nobody was playing, in a league he does not follow, from a country he does
 * not live in. This reads the real table and the real fixtures.
 *
 * Two things the shape has to be honest about.
 *
 * **The free tier of the source returns five rows of the table and one
 * fixture, not eighteen and a round.** So the card says "первая пятёрка" and
 * means it. It is not the whole league and must never be drawn as though it
 * were. A paid key put in `HOLOVANT_SPORTSDB_KEY` lifts the cap and the same
 * code then shows everything that comes back.
 *
 * **A club not in the table is not a club in last place.** Every part of this
 * report can be missing on its own, and missing is written as nothing rather
 * than as a plausible figure.
 */

import { fetchLimitedJson } from "./fetchLimited";

/** A table of five rows and a fixture are a few kilobytes. */
const MAX_REPLY_BYTES = 500_000;
const TIMEOUT_MS = 8000;
/** Football moves in ninety-minute steps; a minute-fresh table is pointless. */
const CACHE_MS = 10 * 60_000;

const SUPER_LIG = "4339";

/**
 * The three clubs whose European fixtures belong on this card. Their ids come
 * from the table endpoint itself, read once and written down: the big three
 * are not always inside a five-row table, and a fixture that only appears when
 * the club is winning is not a fixture list.
 */
const ISTANBUL_CLUBS = [
  { id: "133804", name: "Galatasaray" },
  { id: "133807", name: "Fenerbahçe" },
  { id: "133794", name: "Beşiktaş" },
];

export interface LeagueRow {
  rank: number;
  team: string;
  played: number;
  points: number;
  goalDifference: number;
  /** Recent results as В/Н/П. The source does not say which end is newest, so
   *  neither does the card. */
  form: string | null;
}

export interface Fixture {
  /** "Göztepe — Gaziantep", already joined for a screen. */
  title: string;
  competition: string;
  /** ISO, or null when the source gave no time. */
  at: string | null;
  /** "1:0" once it has been played, null before kick-off. */
  score: string | null;
}

export interface FootballReport {
  state: "ok" | "unreachable";
  /** "2026-2027", so a card never shows last season's table as this one's. */
  season: string | null;
  /** As many rows as the key allows: five on the free tier. */
  table: LeagueRow[];
  /** True when the table is a slice rather than the whole league. */
  partial: boolean;
  /** Next matches, the league's own and the Istanbul clubs' European ones. */
  next: Fixture[];
  /** The last result the source reports. */
  last: Fixture | null;
}

/** The season the source labels the current one, as "2026-2027". */
export function seasonFor(now: Date): string {
  const year = now.getFullYear();
  // A Turkish season runs August to May, so anything before July belongs to
  // the season that started the previous calendar year.
  return now.getMonth() >= 6 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

interface RawStanding {
  intRank?: string;
  strTeam?: string;
  intPlayed?: string;
  intPoints?: string;
  intGoalDifference?: string;
  strForm?: string;
}

interface RawEvent {
  strEvent?: string;
  strHomeTeam?: string;
  strAwayTeam?: string;
  strLeague?: string;
  strTimestamp?: string;
  dateEvent?: string;
  intHomeScore?: string | null;
  intAwayScore?: string | null;
}

function toInt(value: string | undefined): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** W/D/L as a Russian speaker writes them: выигрыш, ничья, проигрыш. */
export function formInRussian(form: string | undefined | null): string | null {
  if (!form) return null;
  const letters = form
    .toUpperCase()
    .split("")
    .map((letter) => ({ W: "В", D: "Н", L: "П" })[letter])
    .filter((letter): letter is string => Boolean(letter));
  return letters.length ? letters.join("") : null;
}

/**
 * The table, from whatever the source returned.
 *
 * A row missing its rank or its team is dropped rather than defaulted: a
 * nameless club at position zero is worse than one row fewer.
 */
export function parseTable(payload: unknown): LeagueRow[] {
  const rows = (payload as { table?: RawStanding[] } | null)?.table;
  if (!Array.isArray(rows)) return [];

  const parsed: LeagueRow[] = [];
  for (const row of rows) {
    const rank = toInt(row.intRank);
    const team = row.strTeam?.trim();
    if (rank === null || !team) continue;
    parsed.push({
      rank,
      team,
      played: toInt(row.intPlayed) ?? 0,
      points: toInt(row.intPoints) ?? 0,
      goalDifference: toInt(row.intGoalDifference) ?? 0,
      form: formInRussian(row.strForm),
    });
  }
  return parsed.sort((a, b) => a.rank - b.rank);
}

/** One fixture, or null when there is not enough of it to show. */
export function parseFixture(event: RawEvent | undefined): Fixture | null {
  if (!event) return null;
  const home = event.strHomeTeam?.trim();
  const away = event.strAwayTeam?.trim();
  // An em dash rather than "vs": the card is in Russian.
  const title = home && away ? `${home} — ${away}` : event.strEvent?.trim();
  if (!title) return null;

  const homeScore = toInt(event.intHomeScore ?? undefined);
  const awayScore = toInt(event.intAwayScore ?? undefined);

  return {
    title,
    competition: event.strLeague?.trim() || "—",
    at: event.strTimestamp?.trim() || event.dateEvent?.trim() || null,
    // Both halves or neither: "1:" is not a score.
    score: homeScore !== null && awayScore !== null ? `${homeScore}:${awayScore}` : null,
  };
}

export function parseFixtures(payload: unknown): Fixture[] {
  const events = (payload as { events?: RawEvent[] } | null)?.events;
  if (!Array.isArray(events)) return [];
  return events
    .map(parseFixture)
    .filter((fixture): fixture is Fixture => fixture !== null);
}

/**
 * Fixtures in the order they will be played, with the same match listed once.
 *
 * A league fixture and a club's own next match can be the same game arriving
 * from two endpoints, and a card that lists it twice looks broken.
 */
export function mergeFixtures(lists: Fixture[][]): Fixture[] {
  const seen = new Set<string>();
  const all: Fixture[] = [];
  for (const list of lists) {
    for (const fixture of list) {
      const key = `${fixture.title}|${fixture.at ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(fixture);
    }
  }
  return all.sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""));
}

let cached: { at: number; report: FootballReport } | null = null;

function apiKey(): string {
  // "3" is the source's own free key. Nothing here needs an account; a paid
  // key only lifts the row limit.
  return process.env.HOLOVANT_SPORTSDB_KEY?.trim() || "3";
}

function endpoint(path: string): string {
  return `https://www.thesportsdb.com/api/v1/json/${apiKey()}/${path}`;
}

async function read<T>(path: string): Promise<T | null> {
  try {
    return await fetchLimitedJson<T>(endpoint(path), {
      timeoutMs: TIMEOUT_MS,
      maxBytes: MAX_REPLY_BYTES,
    });
  } catch (error) {
    console.error(`[football] ${path} could not be read:`, error);
    return null;
  }
}

export async function fetchFootball(now: Date = new Date()): Promise<FootballReport> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.report;

  const season = seasonFor(now);
  const [table, leagueNext, leaguePast, ...clubNext] = await Promise.all([
    read<unknown>(`lookuptable.php?l=${SUPER_LIG}&s=${season}`),
    read<unknown>(`eventsnextleague.php?id=${SUPER_LIG}`),
    read<unknown>(`eventspastleague.php?id=${SUPER_LIG}`),
    ...ISTANBUL_CLUBS.map((club) => read<unknown>(`eventsnext.php?id=${club.id}`)),
  ]);

  const rows = parseTable(table);
  // Nothing at all came back: say so rather than draw an empty league.
  if (rows.length === 0 && leagueNext === null) {
    return { state: "unreachable", season: null, table: [], partial: false, next: [], last: null };
  }

  const report: FootballReport = {
    state: "ok",
    season,
    table: rows,
    // The Süper Lig has eighteen clubs. Fewer rows than that is a slice, and
    // the card has to say which it is looking at.
    partial: rows.length > 0 && rows.length < 18,
    next: mergeFixtures([parseFixtures(leagueNext), ...clubNext.map(parseFixtures)]),
    last: parseFixtures(leaguePast)[0] ?? null,
  };
  cached = { at: Date.now(), report };
  return report;
}
