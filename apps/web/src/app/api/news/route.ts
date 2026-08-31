import { NextResponse } from "next/server";
import { getNewsTopics } from "@/server/userMemory";
import { isSearchConfigured, searchWeb } from "@/server/webSearch";

export const runtime = "nodejs";

/**
 * News on the subjects he actually follows.
 *
 * Kept apart from the other cards because it is the one that costs money and
 * seconds: every miss is an outbound search. It is cached hard, and it is
 * empty rather than generic when he has not said what to watch — a card
 * showing whatever the internet is loudest about today is the same invention
 * as the headline it used to ship with.
 */

export interface NewsItem {
  title: string;
  source: string;
  url: string;
}

export interface NewsReport {
  state: "ok" | "no-topics" | "no-search" | "unreachable";
  /** As he phrased them, so the card can show him what it is watching. */
  topics: string | null;
  items: NewsItem[];
}

const CACHE_MS = 15 * 60_000;
let cached: { at: number; topics: string; report: NewsReport } | null = null;

/** The domain, which is what a reader recognises — not the whole address. */
function sourceOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export async function GET() {
  const topics = await getNewsTopics().catch(() => null);
  if (!topics) return NextResponse.json({ state: "no-topics", topics: null, items: [] } satisfies NewsReport);
  if (!isSearchConfigured()) {
    return NextResponse.json({ state: "no-search", topics, items: [] } satisfies NewsReport);
  }

  if (cached && cached.topics === topics && Date.now() - cached.at < CACHE_MS) {
    return NextResponse.json(cached.report);
  }

  try {
    const results = await searchWeb(`${topics} новости`, 6);
    const report: NewsReport = {
      state: "ok",
      topics,
      items: results.map((result) => ({
        title: result.title,
        source: sourceOf(result.url),
        url: result.url,
      })),
    };
    cached = { at: Date.now(), topics, report };
    return NextResponse.json(report);
  } catch (error) {
    console.error("[news] search failed:", error);
    return NextResponse.json({ state: "unreachable", topics, items: [] } satisfies NewsReport);
  }
}
