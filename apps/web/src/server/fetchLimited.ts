/**
 * Reading from somebody else's server, with a limit on both time and size.
 *
 * Every outbound fetch here already gave up after eight seconds, which stops a
 * slow feed and does nothing about a large one: a calendar address that
 * answers quickly with a gigabyte buffers the lot into memory. On the owner's
 * own laptop that is a crash; on a café network, where the reply can be
 * replaced in flight, it is somebody else's choice.
 */

import { assertPublicDestination, type Resolve } from "./destination";

export class ResponseTooLarge extends Error {
  constructor(maxBytes: number) {
    super(`Response is larger than ${maxBytes} bytes.`);
    this.name = "ResponseTooLarge";
  }
}

/**
 * Reads a response as text, stopping if it grows past the cap.
 *
 * Decoded with a streaming decoder rather than chunk by chunk: a multi-byte
 * character split across two chunks — and his calendar is full of Russian —
 * comes out as replacement marks if each chunk is decoded on its own.
 */
export async function readCapped(response: Response, maxBytes: number): Promise<string> {
  const body = response.body;
  if (!body) return "";

  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  let total = 0;
  let text = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new ResponseTooLarge(maxBytes);
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    // Whether it ended or was refused, the connection is not left open.
    await reader.cancel().catch(() => {});
  }

  return text + decoder.decode();
}

export interface LimitedFetch {
  timeoutMs?: number;
  maxBytes: number;
}

/** Enough for any real feed; a chain longer than this is a loop or a trick. */
const MAX_REDIRECTS = 5;

/**
 * Fetches and reads within both limits, or throws.
 *
 * Redirects are followed by hand so that every hop is checked. Left to fetch,
 * a public address could answer "go to 169.254.169.254" and the check on the
 * first address would have been for nothing.
 */
export async function fetchLimited(
  url: string,
  limits: LimitedFetch,
  resolve?: Resolve,
): Promise<string> {
  const signal = AbortSignal.timeout(limits.timeoutMs ?? 8000);
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicDestination(current, resolve);
    const response = await fetch(current, { signal, redirect: "manual" });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      current = new URL(location, current).toString();
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return readCapped(response, limits.maxBytes);
  }
  throw new Error("Too many redirects.");
}

/** The same, for a reply that should be JSON. */
export async function fetchLimitedJson<T>(url: string, limits: LimitedFetch): Promise<T> {
  return JSON.parse(await fetchLimited(url, limits)) as T;
}
