import { NextResponse } from "next/server";
import { searchWeb, SearchError, type SearchResult } from "@/server/webSearch";

export type { SearchResult };

/** Runs on the server so the API key never reaches the browser. */
export async function POST(request: Request) {
  let query: string;
  try {
    const body = (await request.json()) as { query?: unknown };
    query = typeof body.query === "string" ? body.query.trim() : "";
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  if (!query) return NextResponse.json({ error: "Empty query." }, { status: 400 });

  try {
    const results = await searchWeb(query);
    return NextResponse.json({ query, results });
  } catch (err) {
    if (err instanceof SearchError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Search request failed." }, { status: 504 });
  }
}
