import { NextResponse } from "next/server";

export interface SearchResult {
  title: string;
  url: string;
  description: string;
}

const ENDPOINT = "https://api.firecrawl.dev/v2/search";
const RESULT_LIMIT = 5;
/** A voice answer that arrives after this is no longer a conversation. */
const TIMEOUT_MS = 12000;

interface FirecrawlItem {
  title?: string;
  url?: string;
  description?: string;
  snippet?: string;
}

/** How much of a description survives; the rest is never read aloud or shown. */
const DESCRIPTION_LIMIT = 220;

/**
 * Provider descriptions arrive as page markdown — embedded images, link
 * syntax, headings and hard line breaks. Rendered raw they are unreadable, and
 * spoken aloud they are worse, so the markup is stripped down to prose.
 */
function cleanDescription(raw: string): string {
  let text = raw.replace(/!\[[^\]]*\]\([^)]*\)/g, " "); // images

  // Repeated because citation markup nests — "[[1]](url)" needs two passes
  // before the label is bare, and one pass leaves "[[1]](" behind.
  for (let pass = 0; pass < 3; pass++) {
    text = text.replace(/\[([^[\]]*)\]\([^)]*\)/g, "$1");
  }

  text = text
    // Providers sometimes hand back raw HTML mixed into the markdown, and
    // unclosed fragments like "<br" survive a well-formed-tag pattern.
    .replace(/<[^>]*>/g, " ")
    .replace(/<\/?[a-z]+/gi, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[[\]()]/g, " ") // any bracket residue the passes could not pair up
    .replace(/[#*_`>\\|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > DESCRIPTION_LIMIT ? `${text.slice(0, DESCRIPTION_LIMIT).trimEnd()}…` : text;
}

/**
 * Runs on the server so the API key never reaches the browser. The key is read
 * from the environment and is never returned in a response, including errors.
 */
export async function POST(request: Request) {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Search is not configured on this server." },
      { status: 503 },
    );
  }

  let query: string;
  try {
    const body = (await request.json()) as { query?: unknown };
    query = typeof body.query === "string" ? body.query.trim() : "";
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  if (!query) return NextResponse.json({ error: "Empty query." }, { status: 400 });
  if (query.length > 300) query = query.slice(0, 300);

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, limit: RESULT_LIMIT }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      // The upstream body can echo request details; only the status is passed on.
      return NextResponse.json(
        { error: `Search provider returned ${response.status}.` },
        { status: 502 },
      );
    }

    const payload = (await response.json()) as {
      data?: { web?: FirecrawlItem[] } | FirecrawlItem[];
    };

    // The provider has moved this between shapes across versions; accept both
    // rather than silently returning nothing after an upgrade.
    const raw = Array.isArray(payload.data) ? payload.data : (payload.data?.web ?? []);

    const results: SearchResult[] = raw
      .filter((item): item is FirecrawlItem & { url: string } => typeof item.url === "string")
      .slice(0, RESULT_LIMIT)
      .map((item) => ({
        title: cleanDescription(item.title ?? "") || item.url,
        url: item.url,
        description: cleanDescription(item.description ?? item.snippet ?? ""),
      }));

    return NextResponse.json({ query, results });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return NextResponse.json(
      { error: timedOut ? "Search timed out." : "Search request failed." },
      { status: 504 },
    );
  }
}
