/**
 * The rates he actually watches: the lira against the dollar and the euro, the
 * hryvnia, the euro against the dollar, gold and bitcoin.
 *
 * The card used to show $182,450 of nothing, to everyone. These come from two
 * sources that need no key and no account: one table of currencies quoted
 * against the dollar, and one for metal and bitcoin.
 *
 * Two rules the shape enforces.
 *
 * **Every currency comes from the same table.** The euro against the lira is
 * derived from the dollar rates of both rather than fetched elsewhere, because
 * a cross rate assembled from two providers is not a cross rate — it is the
 * difference between their quotes, which moves on its own.
 *
 * **A row that could not be fetched is empty, not stale and not zero.** Gold
 * failing must not hide the lira, so each row carries its own value or its own
 * nothing.
 */

const CURRENCY_URL = "https://open.er-api.com/v6/latest/USD";
const METAL_URL = "https://api.gold-api.com/price";
const TIMEOUT_MS = 8000;
const CACHE_MS = 10 * 60_000;

export interface RateRow {
  id: string;
  /** What it is, in his words. */
  label: string;
  value: number | null;
  unit: string;
  /** How many places the figure is worth reading to. */
  decimals: number;
}

export interface RatesReport {
  state: "ok" | "unreachable";
  rows: RateRow[];
}

let cached: { at: number; report: RatesReport } | null = null;

/**
 * The six rows, from a table of dollar rates and the two metal prices.
 *
 * Separated from the fetching so the arithmetic can be checked: a cross rate
 * inverted the wrong way is a number that looks perfectly reasonable and is
 * wrong by a factor of the rate itself.
 */
export function buildRows(
  usdRates: Record<string, number> | null,
  gold: number | null,
  bitcoin: number | null,
): RateRow[] {
  const perDollar = (code: string): number | null => {
    const rate = usdRates?.[code];
    return typeof rate === "number" && rate > 0 ? rate : null;
  };

  const try_ = perDollar("TRY");
  const uah = perDollar("UAH");
  const eur = perDollar("EUR");

  return [
    { id: "usd-try", label: "Доллар", value: try_, unit: "₺", decimals: 2 },
    // Lira per euro: both are quoted per dollar, so one divides by the other.
    { id: "eur-try", label: "Евро", value: try_ !== null && eur !== null ? try_ / eur : null, unit: "₺", decimals: 2 },
    { id: "usd-uah", label: "Доллар", value: uah, unit: "₴", decimals: 2 },
    // The table holds euro per dollar; the pair is quoted the other way round.
    { id: "eur-usd", label: "Евро", value: eur !== null ? 1 / eur : null, unit: "$", decimals: 4 },
    { id: "gold", label: "Золото", value: gold, unit: "$ / унция", decimals: 0 },
    { id: "btc", label: "Биткоин", value: bitcoin, unit: "$", decimals: 0 },
  ];
}

/** A figure a person reads, not one a machine printed: 48,25 and 79 003. */
export function formatRate(row: RateRow): string {
  if (row.value === null) return "—";
  return row.value.toLocaleString("ru-RU", {
    minimumFractionDigits: row.decimals,
    maximumFractionDigits: row.decimals,
  });
}

async function readJson(url: string): Promise<unknown | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function readMetal(symbol: string): Promise<number | null> {
  const data = (await readJson(`${METAL_URL}/${symbol}`)) as { price?: unknown } | null;
  return typeof data?.price === "number" ? data.price : null;
}

export async function fetchRates(): Promise<RatesReport> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.report;

  // Fetched together and separately: one source being down costs its own rows
  // and nothing else.
  const [currencies, gold, bitcoin] = await Promise.all([
    readJson(CURRENCY_URL) as Promise<{ rates?: Record<string, number> } | null>,
    readMetal("XAU"),
    readMetal("BTC"),
  ]);

  const rows = buildRows(currencies?.rates ?? null, gold, bitcoin);
  const report: RatesReport = {
    state: rows.some((row) => row.value !== null) ? "ok" : "unreachable",
    rows,
  };

  // A report with nothing in it is not worth remembering for ten minutes.
  if (report.state === "ok") cached = { at: Date.now(), report };
  return report;
}
