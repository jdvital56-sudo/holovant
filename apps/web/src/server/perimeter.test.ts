import { describe, expect, it } from "vitest";
import { isForeignOrigin, isRemoteHost } from "@/server/perimeter";

/**
 * The two locks put on /api/* after a security review, both of which were open
 * on his own machine while he used it.
 *
 * Both directions, as always. A perimeter that refuses the attacker and the
 * owner equally is not a perimeter, it is a broken product — and the owner
 * finds out first.
 */

const SELF = "http://localhost:3000";

describe("a page that is not this one", () => {
  it("refuses a post from somebody else's site", () => {
    // The live hole: an advertisement in the corner of an unrelated page,
    // posted as text/plain so the browser asks nobody, spending his model
    // budget while a Holovant tab happens to be open.
    expect(isForeignOrigin("https://evil.example", SELF)).toBe(true);
    expect(isForeignOrigin("http://ads.example.com", SELF)).toBe(true);
  });

  it("refuses a near miss, because a near miss is the whole trick", () => {
    expect(isForeignOrigin("http://localhost:3001", SELF)).toBe(true);
    expect(isForeignOrigin("https://localhost:3000", SELF)).toBe(true);
    expect(isForeignOrigin("http://localhost.evil.example", SELF)).toBe(true);
  });

  it("lets this page through", () => {
    expect(isForeignOrigin(SELF, SELF)).toBe(false);
  });

  it("lets through a request with no origin at all", () => {
    // Not an attacker being clever: a browser always attaches Origin to a
    // cross-origin post. This is curl, a health check, or the app's own
    // same-origin GET — and refusing them breaks every local tool while
    // closing nothing.
    expect(isForeignOrigin(null, SELF)).toBe(false);
    expect(isForeignOrigin("", SELF)).toBe(false);
  });

  it("follows the address he actually opened", () => {
    // He may open it as 127.0.0.1 rather than localhost. Then that is this
    // page, and localhost is somebody else — which is exactly how the browser
    // sees it too.
    const self = "http://127.0.0.1:3000";
    expect(isForeignOrigin("http://127.0.0.1:3000", self)).toBe(false);
    expect(isForeignOrigin("http://localhost:3000", self)).toBe(true);
  });
});

describe("a caller from across the network", () => {
  it("refuses a device on the same café network", () => {
    // He works from Turkey, in cafés and hotels. /api/brain is a full-text
    // search of his notes and asked nobody who they were.
    expect(isRemoteHost("192.168.1.5:3000")).toBe(true);
    expect(isRemoteHost("10.0.0.14:3000")).toBe(true);
    expect(isRemoteHost("holovant.example.com")).toBe(true);
  });

  it("lets this machine through by every name it has", () => {
    for (const host of ["localhost:3000", "127.0.0.1:3000", "[::1]:3000", "LOCALHOST:3000", "localhost"]) {
      expect(isRemoteHost(host), host).toBe(false);
    }
  });

  it("is not fooled by a name that merely contains one", () => {
    expect(isRemoteHost("localhost.evil.example")).toBe(true);
    expect(isRemoteHost("127.0.0.1.evil.example")).toBe(true);
  });

  it("lets through a request with no host header", () => {
    // HTTP/1.0 tooling on this machine. The real lock on this door is that the
    // server binds to loopback; this one is the second.
    expect(isRemoteHost(null)).toBe(false);
  });
});
