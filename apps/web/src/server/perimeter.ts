/**
 * Who is allowed to reach /api/*, decided separately from the middleware so it
 * can be checked without inventing a request object.
 */

/**
 * A request sent by a page that is not this one.
 *
 * The hole this closes was open on the owner's own machine, needing no network
 * access and no permission: while a Holovant tab is open, **any other page in
 * the same browser** — an advertisement in the corner of an unrelated site —
 * could post to `http://localhost:3000/api/chat` and spend his model budget.
 * A form posted as `text/plain` needs no preflight, so the browser sends it
 * without asking anyone, and nothing here looked at where it came from.
 *
 * A browser always attaches `Origin` to a cross-origin post, so a missing one
 * is not an attacker being clever — it is curl, a health check, or the app's
 * own same-origin GET. Refusing those would break every local tool and close
 * nothing.
 */
export function isForeignOrigin(origin: string | null, self: string): boolean {
  if (!origin) return false;
  return origin !== self;
}

/**
 * The address the browser actually asked for, which is the only thing its
 * `Origin` can be compared against.
 *
 * The check above was right and what it was handed was wrong. The middleware
 * passed Next's own `nextUrl.origin`, which reports `http://localhost:3000`
 * whatever the request said — so opening the app as `127.0.0.1` made every
 * POST the page sent look like it came from somebody else. Answers, music,
 * favourites, everything the assistant remembers: all refused. GETs carry no
 * `Origin` and went on working, so the cards kept showing real data, and from
 * the outside it reads as an assistant that has forgotten everything and
 * cannot answer anything.
 *
 * @param host the `Host` header — what the browser typed, including the port
 * @param protocol the scheme this connection arrived on, as `"http:"`
 * @param forwardedProto `X-Forwarded-Proto`, when a proxy ended the TLS
 * @returns an origin to compare against, or `""` when there is nothing to
 *   compare with — which refuses rather than guesses
 */
export function selfOrigin(
  host: string | null,
  protocol: string,
  forwardedProto: string | null,
): string {
  if (!host) return "";
  // A proxy chain sends a list; the first entry is what the browser saw.
  const scheme = (forwardedProto?.split(",")[0]?.trim() || protocol).replace(/:$/, "");
  return `${scheme}://${host}`;
}

/** Loopback by any of its names, including the bracketed IPv6 form. */
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * A caller that reached this machine across a network rather than from it.
 *
 * With no token configured the perimeter used to let everything through, which
 * is right for a program nobody else can reach and wrong the moment the laptop
 * joins a café or hotel network: `/api/brain` is a full-text search of his
 * Obsidian vault, and `/api/cards` names his city, his next meeting and his
 * projects. Neither asked anybody who they were.
 *
 * The server binds to loopback for the same reason; this is the second lock on
 * the same door, for the case where it is started some other way.
 */
export function isRemoteHost(host: string | null): boolean {
  if (!host) return false;
  const name = host.replace(/:\d+$/, "").toLowerCase();
  return !LOOPBACK_HOSTS.has(name);
}

export interface RateBucket {
  name: "speech" | "costly" | "plain";
  /** Requests allowed per minute. */
  ceiling: number;
}

/**
 * Which budget a request spends.
 *
 * Speech used to share the model's thirty a minute. Every sentence is its own
 * request to /api/speak, so a lively exchange ran the shared budget out, the
 * server answered 429, and the browser's voice took over mid-conversation.
 * Synthesis is local CPU, not money; the model is money. They are held apart.
 */
export function rateBucket(path: string): RateBucket {
  // Exact segment, so /api/speakers is not speech.
  if (/^\/api\/speak(?:\/|$)/.test(path)) return { name: "speech", ceiling: 180 };
  if (/^\/api\/(chat|search|music)(?:\/|$)/.test(path)) return { name: "costly", ceiling: 30 };
  return { name: "plain", ceiling: 60 };
}

/**
 * Who a caller is, for the rate limit.
 *
 * X-Forwarded-For is written by whoever sends the request, so keying on it
 * let a caller name a fresh address every time and never be limited. It is
 * read only when the operator has said a proxy in front sets it
 * (HOLOVANT_TRUST_PROXY=1); otherwise every caller is the one local bucket,
 * which is also the truth for a server bound to loopback.
 *
 * @param header reads one request header by name
 * @param trustProxy whether a proxy in front of this server sets the header
 */
export function clientKeyFrom(
  header: (name: string) => string | null,
  trustProxy: boolean,
): string {
  if (!trustProxy) return "local";
  // The first entry is the client; later ones are the proxies it passed.
  return (
    header("x-forwarded-for")?.split(",")[0]?.trim() ||
    header("x-real-ip")?.trim() ||
    "local"
  );
}

/**
 * Compares two secrets in the same time whatever they contain.
 *
 * `!==` stops at the first different character, so how long a refusal takes
 * says how much of a guess was right. node:crypto's timingSafeEqual is not
 * available here: middleware runs on the edge runtime.
 */
export function safeEqual(presented: string | null | undefined, expected: string): boolean {
  if (typeof presented !== "string" || !expected) return false;
  // Walked over the expected length every time, so a short guess costs the
  // same as a long one; a length mismatch is folded in rather than returned.
  let difference = presented.length ^ expected.length;
  for (let i = 0; i < expected.length; i++) {
    difference |= (presented.charCodeAt(i) || 0) ^ expected.charCodeAt(i);
  }
  return difference === 0;
}
