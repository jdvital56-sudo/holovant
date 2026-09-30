import { describe, expect, it } from "vitest";
import { assertPublicDestination, isPrivateAddress } from "./destination";

/**
 * The server fetching whatever it is told to, from inside its own network.
 * Both directions matter: every real source he uses must still be fetched,
 * and nothing inside the network may be.
 */

/** A pretend DNS, so the rule is checked without the network. */
const dns = (table: Record<string, string[]>) => async (host: string) => table[host] ?? [];

describe("addresses that are not on the public internet", () => {
  it("are recognised, in both IP versions", () => {
    for (const ip of [
      "127.0.0.1",
      "10.0.0.14",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.5",
      "169.254.169.254", // the cloud metadata address, the prize in every SSRF
      "100.64.0.1",
      "0.0.0.0",
      "::1",
      "fd00::1",
      "fe80::1",
      "::ffff:127.0.0.1",
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it("does not catch public ones, including the neighbours of private ranges", () => {
    // The near misses are where a sloppy range check goes wrong.
    for (const ip of ["8.8.8.8", "172.15.0.1", "172.32.0.1", "100.63.0.1", "1.1.1.1", "2606:4700::1111"]) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });
});

describe("where the server may fetch from", () => {
  it("still reaches every source he actually uses", async () => {
    // The direction that must not break: a guard that stops the weather is a
    // broken product, not a secure one.
    const resolve = dns({
      "api.open-meteo.com": ["188.40.39.80"],
      "open.er-api.com": ["104.21.2.3"],
      "api.gold-api.com": ["172.67.1.1"],
      "www.thesportsdb.com": ["104.26.8.8"],
      "calendar.google.com": ["142.250.187.14"],
    });
    for (const url of [
      "https://api.open-meteo.com/v1/forecast?latitude=36.5",
      "https://open.er-api.com/v6/latest/USD",
      "https://api.gold-api.com/price/XAU",
      "https://www.thesportsdb.com/api/v1/json/3/lookuptable.php?l=4339",
      "https://calendar.google.com/calendar/ical/x/private-y/basic.ics",
    ]) {
      await expect(assertPublicDestination(url, resolve), url).resolves.toBeUndefined();
    }
  });

  it("refuses the metadata address and the local network written as an address", async () => {
    for (const url of [
      "http://169.254.169.254/latest/meta-data/",
      "http://127.0.0.1:3000/api/brain",
      "http://192.168.1.1/",
      "http://[::1]:8080/",
    ]) {
      await expect(assertPublicDestination(url, dns({})), url).rejects.toThrow("Refused");
    }
  });

  it("refuses a public-looking name that resolves inside the network", async () => {
    // A name is only as public as the address it points at.
    const resolve = dns({ "totally-public.example": ["10.0.0.5"] });
    await expect(assertPublicDestination("https://totally-public.example/cal.ics", resolve)).rejects.toThrow(
      "private network",
    );
  });

  it("refuses a name with any private address among its answers", async () => {
    const resolve = dns({ "split.example": ["93.184.216.34", "127.0.0.1"] });
    await expect(assertPublicDestination("https://split.example/", resolve)).rejects.toThrow("Refused");
  });

  it("refuses localhost and anything that is not a web address", async () => {
    for (const url of ["http://localhost:3000/", "http://app.localhost/", "file:///C:/Users/secret.txt", "ftp://x.example/", "not a url"]) {
      await expect(assertPublicDestination(url, dns({})), url).rejects.toThrow("Refused");
    }
  });
});
