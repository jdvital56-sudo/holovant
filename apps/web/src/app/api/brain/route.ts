import { NextResponse } from "next/server";
import { searchBrain, brainStats, isBrainConnected } from "@/server/brain";

export const runtime = "nodejs";

/** Note contents never leave the server except as the excerpts asked for. */
const MAX_QUERY_CHARS = 200;

export async function GET() {
  return NextResponse.json(await brainStats());
}

export async function POST(request: Request) {
  if (!isBrainConnected()) {
    // Not an error: a customer who has not connected a vault should be told
    // how, not shown a failure.
    return NextResponse.json(
      { connected: false, notes: [], error: "No knowledge base is connected." },
      { status: 501 },
    );
  }

  let query: string;
  try {
    const body = (await request.json()) as { query?: unknown };
    query = typeof body.query === "string" ? body.query.trim().slice(0, MAX_QUERY_CHARS) : "";
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  if (!query) return NextResponse.json({ error: "Empty query." }, { status: 400 });

  try {
    const notes = await searchBrain(query);
    return NextResponse.json({ connected: true, query, notes });
  } catch {
    return NextResponse.json({ error: "Could not read the knowledge base." }, { status: 500 });
  }
}
