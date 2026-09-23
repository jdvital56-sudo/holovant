import { describe, expect, it } from "vitest";
import { isForeignOrigin, isRemoteHost, selfOrigin } from "@/server/perimeter";

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

/**
 * The address the browser actually asked for.
 *
 * This is the half that was wrong, and it cost him a fortnight. The middleware
 * compared Origin against Next's own `nextUrl.origin`, which reports
 * "http://localhost:3000" no matter what the request said. So when he opened
 * the app as 127.0.0.1 — because that is the link I gave him — every POST it
 * made was refused as foreign: answers, music, favourites, everything it
 * remembers. GETs carry no Origin and went on working, so the cards still
 * showed data. From the outside it reads as an assistant that has forgotten
 * everything and cannot answer anything.
 */
describe("the address the browser asked for", () => {
  it("is the host it sent, not the one the framework assumes", () => {
    expect(selfOrigin("127.0.0.1:3000", "http:", null)).toBe("http://127.0.0.1:3000");
    expect(selfOrigin("localhost:3000", "http:", null)).toBe("http://localhost:3000");
  });

  it("lets both of his ways of opening the page through", () => {
    // The whole bug, as one pair of rows.
    for (const host of ["127.0.0.1:3000", "localhost:3000"]) {
      const self = selfOrigin(host, "http:", null);
      expect(isForeignOrigin(`http://${host}`, self), host).toBe(false);
    }
  });

  it("still refuses somebody else's site, whichever way he opened it", () => {
    // The direction that must not be lost while fixing the other one.
    for (const host of ["127.0.0.1:3000", "localhost:3000"]) {
      const self = selfOrigin(host, "http:", null);
      expect(isForeignOrigin("https://evil.example", self), host).toBe(true);
      expect(isForeignOrigin("http://ads.example.com", self), host).toBe(true);
      // A different local port is a different program on his own machine.
      expect(isForeignOrigin("http://localhost:5173", self), host).toBe(true);
    }
  });

  it("follows a proxy that terminated the TLS", () => {
    // Behind a proxy the connection here is plain http while the browser saw
    // https, and its Origin says so.
    expect(selfOrigin("app.example.com", "http:", "https")).toBe("https://app.example.com");
    expect(selfOrigin("app.example.com", "http:", "https, http")).toBe("https://app.example.com");
  });

  it("matches nothing at all when there is no host to compare with", () => {
    // Refusing is the safe direction: a request with an Origin and no Host is
    // not something to guess about.
    expect(isForeignOrigin("http://localhost:3000", selfOrigin(null, "http:", null))).toBe(true);
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
