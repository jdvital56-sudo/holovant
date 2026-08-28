import { NextResponse } from "next/server";

/**
 * Finds a playable track.
 *
 * Two paths. With `YOUTUBE_API_KEY` set it asks the YouTube Data API, which is
 * the supported way and can ask for embeddable videos only — the player embeds
 * what it finds, and a video whose owner forbids embedding is a dead panel.
 * Without a key it falls back to reading the results page, which works but is
 * against YouTube's terms and breaks whenever the markup changes; that path
 * exists so the feature still runs on a fresh clone with nothing configured.
 *
 * The free quota is 10,000 units a day and a search costs 100 of them — a
 * hundred searches. Hence the cache: asking for the same track twice should
 * not cost twice.
 */

const TIMEOUT_MS = 10000;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export interface MusicHit {
  videoId: string;
  title: string;
}

/** Kept on globalThis so a hot reload in development does not throw away the
 *  quota already spent. */
const globalCache = globalThis as typeof globalThis & {
  __holovantMusicCache?: Map<string, { at: number; hit: MusicHit }>;
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 500;

function cached(query: string): MusicHit | null {
  const cache = globalCache.__holovantMusicCache;
  const entry = cache?.get(query);
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    cache?.delete(query);
    return null;
  }
  return entry.hit;
}

function remember(query: string, hit: MusicHit) {
  const cache = (globalCache.__holovantMusicCache ??= new Map());
  cache.set(query, { at: Date.now(), hit });
  // Oldest first: Map preserves insertion order, so this drops the least
  // recently added rather than a random one.
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/** The supported path. Returns null when the key is absent or the call fails,
 *  so the caller can fall back rather than leaving the user in silence. */
async function searchViaApi(query: string): Promise<MusicHit | null> {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) return null;

  const url =
    "https://www.googleapis.com/youtube/v3/search" +
    "?part=snippet&type=video&maxResults=1&videoEmbeddable=true" +
    `&q=${encodeURIComponent(query)}&key=${encodeURIComponent(key)}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) {
      // 403 is usually the daily quota; either way the detail is for the log,
      // never the response — the URL it came from carries the key.
      console.error(`[music] YouTube Data API returned ${res.status}`);
      return null;
    }

    const payload = (await res.json()) as {
      items?: Array<{ id?: { videoId?: string }; snippet?: { title?: string } }>;
    };
    const item = payload.items?.[0];
    const videoId = item?.id?.videoId;
    if (!videoId) return null;

    // Titles come back HTML-escaped, and "Tom &amp; Jerry" read aloud is worse
    // than useless.
    const title = (item?.snippet?.title ?? query)
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");

    return { videoId, title };
  } catch (error) {
    console.error("[music] YouTube Data API request failed:", error);
    return null;
  }
}

/** The unsupported path, kept only as a fallback for an unconfigured install. */
async function searchViaPage(query: string): Promise<MusicHit | null> {
  const url =
    "https://www.youtube.com/results?hl=en&gl=US&search_query=" + encodeURIComponent(query);

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;

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
    if (!videoId) videoId = html.match(/"videoId":"([\w-]{11})"/)?.[1] ?? null;
    return videoId ? { videoId, title } : null;
  } catch (error) {
    console.error("[music] results-page lookup failed:", error);
    return null;
  }
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

  const key = query.toLowerCase();
  const known = cached(key);
  if (known) return NextResponse.json(known);

  const hit = (await searchViaApi(query)) ?? (await searchViaPage(query));
  if (!hit) return NextResponse.json({ error: "No video found." }, { status: 404 });

  remember(key, hit);
  return NextResponse.json(hit);
}
