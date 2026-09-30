import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The perimeter as it is actually wired, not only its parts.
 *
 * Its helper functions were tested and correct for two weeks while every POST
 * the page made was refused: the middleware handed the right function the
 * wrong value. A test of the parts could not see that. This one calls the
 * middleware itself with the requests a browser really sends.
 */

type Middleware = (req: NextRequest) => Response;
let middleware: Middleware;

beforeEach(async () => {
  // The rate limiter keeps its counts in module state; a fresh module per test
  // keeps one test's requests from spending another's budget.
  vi.resetModules();
  delete process.env.HOLOVANT_ACCESS_TOKEN;
  delete process.env.HOLOVANT_TRUST_PROXY;
  middleware = (await import("./middleware")).middleware as Middleware;
});

/** A request the way a browser sends it from a page opened at `opened`. */
function fromPage(opened: string, path: string, method = "POST", origin = opened): NextRequest {
  const url = new URL(path, opened);
  return new NextRequest(url, {
    method,
    headers: { host: url.host, origin },
  });
}

const passed = (res: Response) => res.headers.get("x-middleware-next") === "1";

describe("the page talking to its own server", () => {
  it("is let through when opened as 127.0.0.1 — the fortnight of 403s", () => {
    const res = middleware(fromPage("http://127.0.0.1:3000", "/api/chat"));
    expect(res.status).not.toBe(403);
    expect(passed(res)).toBe(true);
  });

  it("is let through when opened as localhost", () => {
    expect(passed(middleware(fromPage("http://localhost:3000", "/api/chat")))).toBe(true);
  });

  it("is let through for every route the page posts to", () => {
    for (const path of ["/api/chat", "/api/speak", "/api/music", "/api/search"]) {
      expect(passed(middleware(fromPage("http://127.0.0.1:3000", path))), path).toBe(true);
    }
  });
});

describe("somebody else's page", () => {
  it("is refused, whichever address the app was opened at", () => {
    for (const opened of ["http://127.0.0.1:3000", "http://localhost:3000"]) {
      const res = middleware(fromPage(opened, "/api/chat", "POST", "https://evil.example"));
      expect(res.status, opened).toBe(403);
    }
  });

  it("is refused when it reaches the server from across the network", () => {
    const res = middleware(fromPage("http://192.168.1.5:3000", "/api/brain", "GET"));
    expect(res.status).toBe(403);
  });
});

describe("the budgets", () => {
  it("lets a long spoken answer through without spending the model's budget", () => {
    // Forty sentences spoken, then a question: the question must still go.
    for (let i = 0; i < 40; i++) {
      expect(passed(middleware(fromPage("http://127.0.0.1:3000", "/api/speak"))), `speak ${i}`).toBe(true);
    }
    expect(passed(middleware(fromPage("http://127.0.0.1:3000", "/api/chat")))).toBe(true);
  });

  it("still stops a runaway loop on the model", () => {
    // The direction that must not loosen: /api/chat costs money.
    let last: Response | null = null;
    for (let i = 0; i < 31; i++) last = middleware(fromPage("http://127.0.0.1:3000", "/api/chat"));
    expect(last?.status).toBe(429);
  });
});

describe("with an access token set", () => {
  it("refuses a request without it and accepts one with it", async () => {
    process.env.HOLOVANT_ACCESS_TOKEN = "s3cret-token";
    vi.resetModules();
    const guarded = (await import("./middleware")).middleware as Middleware;

    const without = guarded(fromPage("http://127.0.0.1:3000", "/api/chat"));
    expect(without.status).toBe(401);

    const url = new URL("/api/chat", "http://127.0.0.1:3000");
    const withToken = guarded(
      new NextRequest(url, {
        method: "POST",
        headers: { host: url.host, origin: "http://127.0.0.1:3000", authorization: "Bearer s3cret-token" },
      }),
    );
    expect(passed(withToken)).toBe(true);

    const wrong = guarded(
      new NextRequest(url, {
        method: "POST",
        headers: { host: url.host, origin: "http://127.0.0.1:3000", authorization: "Bearer s3cret-tokex" },
      }),
    );
    expect(wrong.status).toBe(401);
  });
});
