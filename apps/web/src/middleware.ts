import { NextResponse, type NextRequest } from "next/server";
import { isForeignOrigin, isRemoteHost } from "@/server/perimeter";

/**
 * The perimeter around /api/*.
 *
 * Every route behind it spends something that cannot be got back: model
 * tokens, search credits, CPU on speech synthesis, and — for /api/brain — the
 * contents of the operator's own notes. None of it had a gate.
 *
 * Four rules, in this order:
 *
 * 1. Rate limit, always on. It protects a laptop from a runaway loop as much
 *    as it protects a deployment from a stranger.
 * 2. The request must come from this page. Without this, any other tab in his
 *    browser — an advertisement on an unrelated site — could post to
 *    /api/chat and spend his model budget, needing no network access and no
 *    permission from anyone. That was open while he used it.
 * 3. With no token set, only this machine may call at all. /api/brain is a
 *    full-text search of his Obsidian vault and /api/cards names his city and
 *    his next meeting; on a café network they were answering strangers.
 * 4. A shared token, only when one is configured. Set HOLOVANT_ACCESS_TOKEN
 *    and every API call must carry it — which is also how the door is opened
 *    to other devices deliberately.
 *
 * This is deliberately the smallest thing that closes the hole. Real accounts
 * belong with sign-in and billing, not here.
 */

/** In-memory, so it resets on restart and does not survive across instances —
 *  honest for one process, and the point at which this needs Redis is the
 *  point at which the product has more than one. */
const hits = new Map<string, number[]>();

const WINDOW_MS = 60_000;
/** Generous for a person talking, nowhere near enough to drain an API budget. */
const MAX_PER_WINDOW = 60;
/** Speech and chat are the expensive ones and are held to a tighter count. */
const COSTLY = /^\/api\/(chat|speak|search|music)/;
const MAX_COSTLY_PER_WINDOW = 30;

function clientKey(req: NextRequest): string {
  // No x-forwarded-for on a local request; the fallback keeps one bucket
  // rather than letting every unknown caller have its own.
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local"
  );
}

function overLimit(key: string, ceiling: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);

  // The map would otherwise grow one entry per address seen, forever.
  if (hits.size > 5000) {
    for (const [k, times] of hits) {
      if (!times.some((t) => now - t < WINDOW_MS)) hits.delete(k);
    }
  }

  return recent.length > ceiling;
}

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const key = clientKey(req);
  const ceiling = COSTLY.test(path) ? MAX_COSTLY_PER_WINDOW : MAX_PER_WINDOW;

  if (overLimit(`${key}:${COSTLY.test(path) ? "costly" : "plain"}`, ceiling)) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  // Sent by the browser on every cross-origin post, and absent on the app's
  // own GETs and on curl — so a mismatch is the only thing worth refusing.
  if (isForeignOrigin(req.headers.get("origin"), req.nextUrl.origin)) {
    return NextResponse.json({ error: "Cross-origin requests are refused." }, { status: 403 });
  }

  const required = process.env.HOLOVANT_ACCESS_TOKEN?.trim();
  if (!required) {
    // No token means no way to tell one caller from another, so the only safe
    // audience is this machine. Setting a token is what opens it wider.
    if (isRemoteHost(req.headers.get("host"))) {
      return NextResponse.json(
        { error: "Set HOLOVANT_ACCESS_TOKEN to allow calls from other devices." },
        { status: 403 },
      );
    }
    return NextResponse.next();
  }

  const presented =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    req.cookies.get("hv_session")?.value;

  if (presented !== required) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
