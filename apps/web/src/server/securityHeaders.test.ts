import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "./securityHeaders";

/**
 * A content security policy fails in one direction silently: the browser
 * refuses a request and nothing on screen says why. So the hosts it must allow
 * are read out of the code the browser runs, not written from memory.
 */

function directive(name: string): string {
  const found = contentSecurityPolicy()
    .split(";")
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${name} `));
  return found ?? "";
}

function browserSources(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      // Server code is not subject to the page's policy.
      if (entry === "server" || entry === "api") continue;
      browserSources(full, found);
    } else if (/\.(ts|tsx|css)$/.test(entry) && !/\.test\./.test(entry)) {
      // CSS too: the interface fonts are imported from globals.css, and the
      // first version of this test read only .ts — so the policy it approved
      // blocked every font in the product, which a browser caught and it did not.
      found.push(full);
    }
  }
  return found;
}

describe("what the page must still be allowed to load", () => {
  it("lets hand tracking fetch its runtime and its model", () => {
    expect(directive("script-src")).toContain("https://cdn.jsdelivr.net");
    expect(directive("script-src")).toContain("'wasm-unsafe-eval'");
    expect(directive("connect-src")).toContain("https://cdn.jsdelivr.net");
    expect(directive("connect-src")).toContain("https://storage.googleapis.com");
  });

  it("lets the interface fonts load", () => {
    // Sora and JetBrains Mono come from Google Fonts: a stylesheet from one
    // host and the font files from another.
    expect(directive("style-src")).toContain("https://fonts.googleapis.com");
    expect(directive("font-src")).toContain("https://fonts.gstatic.com");
  });

  it("lets the music player load", () => {
    expect(directive("frame-src")).toContain("https://www.youtube-nocookie.com");
  });

  it("lets synthesised speech play", () => {
    // Every spoken line is a blob played from an object URL. Without this the
    // product's own voice goes quiet and the browser's takes over.
    expect(directive("media-src")).toContain("blob:");
  });

  it("covers every external host the browser code actually calls", () => {
    // Read from the code, so adding a new one without adding it here fails
    // the build instead of failing silently in someone's browser.
    const policy = contentSecurityPolicy();
    const hosts = new Set<string>();
    for (const file of browserSources("src")) {
      for (const match of readFileSync(file, "utf-8").matchAll(/https:\/\/([a-z0-9.-]+)\//gi)) {
        hosts.add(match[1]);
      }
    }
    // Addresses the assistant opens in a new tab, and examples in comments,
    // are navigations, not loads.
    const navigatedTo = new Set(["ru.wikipedia.org", "www.youtube.com", "x.com", "example.com"]);
    for (const host of hosts) {
      if (navigatedTo.has(host)) continue;
      expect(policy, host).toContain(host);
    }
  });
});

describe("what the page must refuse", () => {
  it("cannot be framed by anyone", () => {
    expect(directive("frame-ancestors")).toBe("frame-ancestors 'none'");
    const frameOptions = securityHeaders().find((h) => h.key === "X-Frame-Options");
    expect(frameOptions?.value).toBe("DENY");
  });

  it("loads no plugins and keeps its own base URL", () => {
    expect(directive("object-src")).toBe("object-src 'none'");
    expect(directive("base-uri")).toBe("base-uri 'self'");
  });

  it("takes scripts from itself and one CDN, not from anywhere", () => {
    const sources = directive("script-src").split(" ");
    // A bare "https:" or "*" would allow a script from any site at all.
    expect(sources).not.toContain("*");
    expect(sources).not.toContain("https:");
    expect(sources.filter((s) => s.startsWith("https://"))).toEqual([
      "https://cdn.jsdelivr.net",
    ]);
  });

  it("gives the microphone and camera to this page only, and no location at all", () => {
    const permissions = securityHeaders().find((h) => h.key === "Permissions-Policy")?.value ?? "";
    expect(permissions).toContain("microphone=(self)");
    expect(permissions).toContain("camera=(self)");
    expect(permissions).toContain("geolocation=()");
  });
});
