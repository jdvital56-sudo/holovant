import { NextResponse } from "next/server";

/**
 * Finds a playable track by reading YouTube's own results page.
 *
 * The generic web search behind /api/search comes back with channel pages,
 * articles and aggregator links for anything but the most literal title, and
 * the player needs a watch id. YouTube's results page always carries one, so
 * for music this asks it directly and falls back to web search only if this
 * fails.
 */

const TIMEOUT_MS = 10000;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export interface MusicHit {
  videoId: string;
  title: string;
}

export async function POST(request: Request) {
  let query = "";
  try {
    const body = (await request.json()) as { query?: unknown };
    query = typeof body.query === "string" ? body.query.trim() : "";
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }
  if (!query) return NextResponse.json({ error: "Empty query." }, { status: 400 });
  if (query.length > 200) query = query.slice(0, 200);

  const url =
    "https://www.youtube.com/results?hl=en&gl=US&search_query=" + encodeURIComponent(query);

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      return NextResponse.json({ error: `YouTube returned ${res.status}.` }, { status: 502 });
    }

    const html = await res.text();

    // The renderer block holds the id and its title together, so a title is
    // never paired with the wrong video.
    const paired = html.match(
      /"videoRenderer":\{"videoId":"([\w-]{11})"[\s\S]{0,900}?"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*?)"/,
    );

    let videoId = paired?.[1] ?? null;
    let title = query;
    if (paired?.[2]) {
      try {
        title = JSON.parse(`"${paired[2]}"`) as string;
      } catch {
        // Keep the query as the title if the escape sequence will not parse.
      }
    }

    // Consent interstitial or a layout change: take the first video id on the
    // page rather than giving up.
    if (!videoId) {
      videoId = html.match(/"videoId":"([\w-]{11})"/)?.[1] ?? null;
    }

    if (!videoId) {
      return NextResponse.json({ error: "No video found." }, { status: 404 });
    }

    return NextResponse.json({ videoId, title } satisfies MusicHit);
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return NextResponse.json(
      { error: timedOut ? "YouTube search timed out." : "YouTube search failed." },
      { status: 504 },
    );
  }
}
