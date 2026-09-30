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

/** True for any address that is not on the public internet. */
export function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return v4Private(ip);
  if (version === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    // An IPv4 address written as IPv6 is judged as the IPv4 address it is.
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return v4Private(mapped[1]);
    return (
      lower.startsWith("fc") || // unique local, fc00::/7
      lower.startsWith("fd") ||
      /^fe[89ab]/.test(lower) // link-local, fe80::/10
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
