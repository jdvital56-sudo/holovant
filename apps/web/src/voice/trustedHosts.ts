/**
 * Which sites may open without being shown to him first.
 *
 * The assistant reads text it did not write: excerpts from notes, titles of
 * calendar entries somebody else sent, descriptions of search results. All of
 * it reaches the model as ordinary words, and the model has hands — one of
 * them opens a web page. A sentence placed in any of those sources can try to
 * steer it, and a page that ranks for a likely question is not hard to make.
 *
 * A prompt can be told to distrust that text and it will mostly obey, which is
 * not the same as a guarantee. **This is the guarantee, and it holds even if
 * the model is completely taken in:** a host he has not approved is never
 * opened without him seeing the host itself — not the title, which the model
 * chose and an attacker may have written.
 *
 * Approving is per host and it sticks, so the cost is one tap the first time a
 * site is ever opened and nothing afterwards. He asked not to be asked every
 * time, and this is how both things are true at once.
 */

const STORAGE_KEY = "holovant.trusted-hosts";

/** The part a person recognises, and the part an attacker cannot fake. */
export function hostOf(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.host.toLowerCase() || null;
  } catch {
    return null;
  }
}

function read(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((h): h is string => typeof h === "string") : [];
  } catch {
    // A browser refusing storage is a browser that asks every time, which is
    // the safe direction to fail in.
    return [];
  }
}

/**
 * Exact host, never a suffix.
 *
 * "wikipedia.org.evil.example" ends with a host he trusts and is a different
 * site entirely; matching on endings is how that trick works.
 */
export function isHostApproved(host: string, approved: string[] = read()): boolean {
  return approved.includes(host.toLowerCase());
}

export function approveHost(host: string): void {
  const cleaned = host.toLowerCase();
  if (!cleaned) return;
  const approved = read();
  if (approved.includes(cleaned)) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...approved, cleaned]));
  } catch {
    // Not remembering is only a second tap next time; nothing is lost.
  }
}

export function approvedHosts(): string[] {
  return read();
}

export function forgetApprovedHosts(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do; the list is a convenience, not a record.
  }
}
