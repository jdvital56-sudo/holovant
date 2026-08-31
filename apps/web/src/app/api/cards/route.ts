import { NextResponse } from "next/server";
import os from "node:os";
import { brainSummary } from "@/server/brain";
import { listProjects, describeAge } from "@/server/projects";
import { fetchEventsForDay, isCalendarConnected } from "@/server/calendar";
import { isLlmConfigured } from "@/server/llm";
import { isPiperConfigured } from "@/server/piperVoice";
import { fetchRates, type RatesReport } from "@/server/rates";
import { getUserPlace } from "@/server/userMemory";
import { fetchWeather } from "@/server/weather";
import { isSearchConfigured } from "@/server/webSearch";

export const runtime = "nodejs";

/**
 * What the cards read, so they stop inventing.
 *
 * Every module in the ring used to show numbers somebody made up — a weather
 * card that read 21° in an empty room, five active projects, twelve unread
 * news. These are the ones that can be true without anyone registering
 * anything: they read the sources already connected to this machine.
 *
 * The shape is built around one rule, which this codebase keeps relearning in
 * new places. **Unknown is never a number.** A card that cannot reach its
 * source says so; it does not fall back to something plausible. An invented
 * 21° is worse than a dash, because he would dress for it.
 */

export interface CardsWeather {
  state: "ok" | "no-place" | "unreachable";
  place: string | null;
  temperatureC: number | null;
  high: number | null;
  low: number | null;
  condition: "clear" | "clouds" | "rain" | "fog" | null;
}

export interface CardsCalendar {
  state: "ok" | "not-connected" | "unreachable";
  eventsToday: number | null;
  nextEvent: string | null;
  /** How many entries the whole feed holds — a clear day is not an empty feed. */
  total: number | null;
}

export interface CardsBrain {
  state: "ok" | "not-connected";
  noteCount: number | null;
  recent: string[];
}

export interface CardsProject {
  name: string;
  branch: string | null;
  /** "8 минут назад", already agreed with its numeral. */
  age: string;
  uncommitted: number | null;
}

export interface CardsProjects {
  state: "ok" | "not-connected";
  count: number | null;
  /** Most recently touched first: "what was I in the middle of". */
  repos: CardsProject[];
}

export interface CardsAi {
  model: string | null;
  configured: boolean;
  voice: "piper" | "browser";
  searchConfigured: boolean;
}

export interface CardsSystem {
  platform: string;
  cpuCount: number;
  memoryUsedPct: number;
  uptimeHours: number;
}

export type CardsRates = RatesReport;

export interface CardsReport {
  weather: CardsWeather;
  rates: CardsRates;
  calendar: CardsCalendar;
  brain: CardsBrain;
  projects: CardsProjects;
  ai: CardsAi;
  system: CardsSystem;
}

/** Open-Meteo's numbered codes, in the four buckets the card draws. */
function conditionFor(code: number): CardsWeather["condition"] {
  if (code === 0 || code === 1) return "clear";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51) return "rain";
  return "clouds";
}

async function readWeather(): Promise<CardsWeather> {
  const place = await getUserPlace().catch(() => null);
  const blank = { place, temperatureC: null, high: null, low: null, condition: null } as const;
  if (!place) return { ...blank, state: "no-place", place: null };

  try {
    const w = await fetchWeather({ place, lang: "ru" });
    return {
      state: "ok",
      place: w.place,
      temperatureC: w.temperature,
      high: w.high,
      low: w.low,
      condition: conditionFor(w.code),
    };
  } catch (error) {
    console.error("[cards] weather could not be read:", error);
    return { ...blank, state: "unreachable" };
  }
}

function clock(at: Date): string {
  return `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
}

async function readCalendar(): Promise<CardsCalendar> {
  const blank = { eventsToday: null, nextEvent: null, total: null } as const;
  if (!isCalendarConnected()) return { ...blank, state: "not-connected" };

  const read = await fetchEventsForDay(new Date());
  if (!read) return { ...blank, state: "unreachable" };

  const [next] = read.events;
  return {
    state: "ok",
    eventsToday: read.events.length,
    nextEvent: next
      ? next.allDay
        ? `весь день — ${next.summary}`
        : `${clock(next.start)} — ${next.summary}`
      : null,
    total: read.total,
  };
}

async function readBrain(): Promise<CardsBrain> {
  const summary = await brainSummary().catch(() => null);
  if (!summary?.connected) return { state: "not-connected", noteCount: null, recent: [] };
  return { state: "ok", noteCount: summary.noteCount, recent: summary.recent };
}

/**
 * His projects: the repositories he works in, and the state he left each in.
 *
 * His notes were the obvious guess and the wrong one — the whole vault has one
 * file with unticked boxes and that file is a template. Repositories are what
 * he actually has four of.
 */
async function readProjects(): Promise<CardsProjects> {
  const repos = await listProjects().catch(() => null);
  if (!repos) return { state: "not-connected", count: null, repos: [] };
  return {
    state: "ok",
    count: repos.length,
    repos: repos.map((repo) => ({
      name: repo.name,
      branch: repo.branch,
      age: describeAge(repo.ageSeconds),
      uncommitted: repo.uncommitted,
    })),
  };
}

function readAi(): CardsAi {
  return {
    model: process.env.HOLOVANT_LLM_MODEL?.trim() || null,
    configured: isLlmConfigured(),
    voice: isPiperConfigured() ? "piper" : "browser",
    searchConfigured: isSearchConfigured(),
  };
}

function readSystem(): CardsSystem {
  const total = os.totalmem();
  return {
    // The OS family without its exact release: a patch level tells a stranger
    // which vulnerabilities to try.
    platform: os.type(),
    cpuCount: os.cpus().length,
    memoryUsedPct: total ? Math.round(((total - os.freemem()) / total) * 100) : 0,
    uptimeHours: Math.round((os.uptime() / 3600) * 10) / 10,
  };
}

export async function GET() {
  const [weather, calendar, brain, projects, rates] = await Promise.all([
    readWeather(),
    readCalendar(),
    readBrain(),
    readProjects(),
    fetchRates().catch(() => ({ state: "unreachable" as const, rows: [] })),
  ]);

  const report: CardsReport = {
    weather,
    calendar,
    brain,
    projects,
    rates,
    ai: readAi(),
    system: readSystem(),
  };
  return NextResponse.json(report);
}
