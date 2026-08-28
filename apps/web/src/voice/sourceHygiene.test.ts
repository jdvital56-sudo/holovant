import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Twice in one session a regex was written through a shell layer that turned a
 * backslash escape into the control character it names — a real 0x08 byte
 * where "\b" was meant. The pattern then searched for a character no transcript
 * contains, matched nothing, and looked perfectly correct in review.
 *
 * Nothing in this source should contain a control character. If this fails,
 * the file was written through something that ate an escape.
 */
function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, found);
    else if (/\.(ts|tsx)$/.test(entry)) found.push(full);
  }
  return found;
}

describe("source hygiene", () => {
  it("contains no stray control characters", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles("src")) {
      const text = readFileSync(file, "utf-8");
      // Tab, newline and carriage return are the only ones that belong.
      const bad = text.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g);
      if (bad) offenders.push(`${file} — ${bad.length} of them`);
    }
    expect(offenders).toEqual([]);
  });
});
