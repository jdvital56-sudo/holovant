/**
 * Web search through Firecrawl.
 *
 * Here rather than in the route because the assistant calls it as a tool: a
 * question that needs today's facts has to reach the same search the voice
 * command uses, not a second implementation that drifts from it.
 */

export interface SearchResult {
  title: string;
  url: string;
  description: string;
}

const ENDPOINT = "https://api.firecrawl.dev/v2/search";
const RESULT_LIMIT = 4;
/** An answer that arrives after this has stopped being a conversation. */
const TIMEOUT_MS = 9000;

interface FirecrawlItem {
  title?: string;
  url?: string;
  description?: string;
  snippet?: string;
}

/** How much of a description survives; the rest is never read aloud or shown. */
const DESCRIPTION_LIMIT = 220;

export function isSearchConfigured(): boolean {
  return Boolean(process.env.FIRECRAWL_API_KEY);
}

export class SearchError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * Provider descriptions arrive as page markdown — embedded images, link
 * syntax, headings and hard line breaks. Rendered raw they are unreadable, and
 * spoken aloud they are worse, so the markup is stripped down to prose.
 */
export function cleanDescription(raw: string): string {
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
 * The key is read here and never leaves the server, including in errors: the
 * upstream body can echo the request, so only the status travels back.
 */
export async function searchWeb(query: string, limit = RESULT_LIMIT): Promise<SearchResult[]> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new SearchError("Search is not configured on this server.", 503);

  const trimmed = query.trim().slice(0, 300);
  if (!trimmed) throw new SearchError("Empty query.", 400);

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: trimmed, limit }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    throw new SearchError(timedOut ? "Search timed out." : "Search request failed.", 504);
  }

  if (!response.ok) {
    throw new SearchError(`Search provider returned ${response.status}.`, 502);
  }

  const payload = (await response.json()) as {
    data?: { web?: FirecrawlItem[] } | FirecrawlItem[];
  };

  // The provider has moved this between shapes across versions; accept both
  // rather than silently returning nothing after an upgrade.
  const raw = Array.isArray(payload.data) ? payload.data : (payload.data?.web ?? []);

  return raw
    .filter((item): item is FirecrawlItem & { url: string } => typeof item.url === "string")
    .slice(0, limit)
    .map((item) => ({
      title: cleanDescription(item.title ?? "") || item.url,
      url: item.url,
      description: cleanDescription(item.description ?? item.snippet ?? ""),
    }));
}
