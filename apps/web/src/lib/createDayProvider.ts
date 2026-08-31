import type { ModuleDataProvider } from "@holovant/module-contracts";
import type { DayReport } from "@/app/api/day/route";

/**
 * Feeds the calendar and weather cards from one call to the server.
 *
 * Both open together often enough, and the report is small, so a single
 * request is shared between them rather than each card fetching its own half.
 * The cache is deliberately short: this is a card someone glances at, and a
 * temperature from ten minutes ago read as current is the same species of lie
 * as an invented one.
 */

const CACHE_MS = 60_000;
const TIMEOUT_MS = 8000;

let cached: { at: number; report: DayReport } | null = null;
let inFlight: Promise<DayReport | null> | null = null;

async function readDay(): Promise<DayReport | null> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.report;
  // Two cards opening at once must not become two requests.
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const response = await fetch("/api/day", { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!response.ok) return null;
      const report = (await response.json()) as DayReport;
      cached = { at: Date.now(), report };
      return report;
    } catch {
      // Left to the caller's fallback, which says the source could not be
      // reached rather than showing a number nobody measured.
      return null;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/**
 * @param part which half of the report this card shows
 * @param whenUnreachable what the card says when the server cannot be asked —
 *   never a plausible figure, always a state that reads as "not known"
 */
export function createDayProvider<TData>(
  part: keyof DayReport,
  whenUnreachable: TData,
): ModuleDataProvider<TData> {
  return {
    async getSnapshot(): Promise<TData> {
      const report = await readDay();
      return report ? (report[part] as TData) : whenUnreachable;
    },
  };
}
