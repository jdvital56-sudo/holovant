import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Code that runs in the browser must never reach code that needs Node.
 *
 * The rates card imported one formatting function from the server module that
 * fetches rates. That pulled the whole module into the page, harmlessly, until
 * the fetch code started checking addresses with node:dns — and the build
 * failed. Tests passed and types checked, because neither looks at what the
 * browser bundle can reach; only `next build` does, and CI does not run it.
 *
 * So this walks the imports from every browser-side file and fails if any path
 * ends at a Node built-in. Type-only imports are erased and do not count.
 */

const SRC = resolve(__dirname);

/** Where browser code lives. API routes and server/ are the server side. */
const CLIENT_ROOTS = ["modules", "hud", "scene", "voice", "gestures", "audio", "stores", "app/page.tsx", "app/layout.tsx"];

const NODE_BUILTINS = /^(node:|fs$|path$|os$|net$|dns$|child_process$|crypto$|http$|https$)/;

function filesUnder(path: string, found: string[] = []): string[] {
  const full = join(SRC, path);
  if (!existsSync(full)) return found;
  if (statSync(full).isFile()) {
    found.push(full);
    return found;
  }
  for (const entry of readdirSync(full)) {
    const child = join(path, entry);
    if (statSync(join(SRC, child)).isDirectory()) filesUnder(child, found);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\./.test(entry)) found.push(join(SRC, child));
  }
  return found;
}

/** Runtime imports only: `import type` and `export type` are erased. */
function runtimeImports(file: string): string[] {
  const source = readFileSync(file, "utf-8");
  const specifiers: string[] = [];
  const pattern = /^\s*(?:import|export)\s+(?!type\b)(?:[^'"]*?\sfrom\s+)?["']([^"']+)["']/gm;
  for (const match of source.matchAll(pattern)) specifiers.push(match[1]);
  return specifiers;
}

function resolveImport(from: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = join(SRC, specifier.slice(2));
  else if (specifier.startsWith(".")) base = resolve(dirname(from), specifier);
  else return null; // a package; packages are the bundler's business
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** The chain of files from `start` to a Node built-in, or null if there is none. */
function pathToNode(start: string): string[] | null {
  const seen = new Set<string>();
  const queue: Array<{ file: string; trail: string[] }> = [{ file: start, trail: [start] }];
  while (queue.length) {
    const { file, trail } = queue.shift()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const specifier of runtimeImports(file)) {
      if (NODE_BUILTINS.test(specifier)) return [...trail, specifier];
      const next = resolveImport(file, specifier);
      if (next && !seen.has(next)) queue.push({ file: next, trail: [...trail, next] });
    }
  }
  return null;
}

const short = (p: string) => p.replace(SRC, "src").replace(/\\/g, "/");

describe("browser code", () => {
  it("never reaches a Node built-in through its imports", () => {
    const offenders: string[] = [];
    for (const root of CLIENT_ROOTS) {
      for (const file of filesUnder(root)) {
        const chain = pathToNode(file);
        if (chain) offenders.push(chain.map(short).join(" → "));
      }
    }
    expect(offenders).toEqual([]);
  });

  it("is actually checked — the walker finds the chain that broke the build", () => {
    // Without this the test above could pass by finding no files at all.
    const destination = join(SRC, "server", "destination.ts");
    expect(pathToNode(destination)?.at(-1)).toMatch(/^node:/);
    expect(filesUnder("modules").length).toBeGreaterThan(10);
  });
});
