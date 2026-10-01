import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Where an outbound request is allowed to go.
 *
 * Every address this server fetches today is set by the owner — the calendar
 * link, the weather and rates APIs — so nothing here is reachable by a
 * stranger yet. The first feature that lets a customer paste in their own
 * calendar link changes that: the server would fetch whatever address it is
 * given, from inside whatever network it runs in, including the cloud
 * provider's metadata address that hands out credentials. That is the review's
 * "dormant SSRF", closed before the feature that wakes it.
 *
 * Checked on every hop of a redirect, because a public address that answers
 * "go to 169.254.169.254" is the whole trick, and checked on the resolved
 * address as well as the name, because a public-looking name can resolve to
 * a private address.
 *
 * What remains: the name is resolved here and again by fetch, and a server
 * that answers the two lookups differently could slip through between them.
 * Closing that means pinning the connection to the checked address, which is
 * worth doing when customer-supplied links actually exist.
 */

export class BlockedDestination extends Error {
  constructor(reason: string) {
    super(`Refused to fetch: ${reason}`);
    this.name = "BlockedDestination";
  }
}

function v4Private(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || // "this network"
    a === 10 ||
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, and the cloud metadata address
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224 // multicast and reserved
  );
}

/**
 * An IPv6 address as its eight 16-bit groups.
 *
 * Judged as numbers, not as text, because the same address has many
 * spellings. The first version matched "::ffff:127.0.0.1" as written — but
 * the URL parser rewrites that to "::ffff:7f00:1" before this code ever sees
 * it, so loopback and the metadata address passed in the form that actually
 * arrives, while the test, written in the other form, stayed green.
 */
function v6Groups(ip: string): number[] | null {
  let text = ip.toLowerCase();
  // A trailing dotted IPv4 part becomes the last two groups.
  const dotted = text.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const [a, b, c, d] = dotted[2].split(".").map(Number);
    text = `${dotted[1]}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...tail].map(
    (g) => parseInt(g, 16),
  );
  return groups.length === 8 && groups.every((g) => g >= 0 && g <= 0xffff) ? groups : null;
}

/** True for any address that is not on the public internet. */
export function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return v4Private(ip);
  if (version === 6) {
    const g = v6Groups(ip);
    // Unparseable is refused: it cannot be shown to be public.
    if (!g) return true;
    const leadingZeros = g.slice(0, 5).every((x) => x === 0);
    // ::ffff:a.b.c.d (mapped) and ::a.b.c.d (the old compatible form) are the
    // IPv4 address in disguise, and are judged as that address. :: and ::1
    // fall under the second: 0.0.0.0 and 0.0.0.1.
    if (leadingZeros && (g[5] === 0xffff || g[5] === 0)) {
      const v4 = `${g[6] >> 8}.${g[6] & 0xff}.${g[7] >> 8}.${g[7] & 0xff}`;
      return v4Private(v4);
    }
    return (
      (g[0] & 0xfe00) === 0xfc00 || // unique local, fc00::/7
      (g[0] & 0xffc0) === 0xfe80 // link-local, fe80::/10
    );
  }
  // Not an address at all: nothing to judge, and the caller resolves names.
  return false;
}

export type Resolve = (host: string) => Promise<string[]>;

const resolveWithDns: Resolve = async (host) =>
  (await lookup(host, { all: true })).map((entry) => entry.address);

/**
 * Throws unless the URL is http or https and every address it resolves to is
 * public.
 *
 * @param resolve replaceable so the rule can be checked without a network
 */
export async function assertPublicDestination(
  url: string,
  resolve: Resolve = resolveWithDns,
): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new BlockedDestination("not a valid address");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new BlockedDestination(`${parsed.protocol} is not a web address`);
  }

  // URL keeps the brackets on an IPv6 host; the address is inside them.
  const host = parsed.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost")) {
    throw new BlockedDestination("a local address");
  }

  const addresses = isIP(host) ? [host] : await resolve(host);
  if (addresses.length === 0) throw new BlockedDestination("the name does not resolve");
  for (const address of addresses) {
    if (isPrivateAddress(address)) {
      throw new BlockedDestination("a private network address");
    }
  }
}
