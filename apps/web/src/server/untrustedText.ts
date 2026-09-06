/**
 * Text this project did not write, on its way to the model.
 *
 * Search descriptions, note excerpts, the titles of calendar entries other
 * people sent, news headlines. It is quoted to the model as ordinary words,
 * and the model has hands.
 *
 * The specific danger this closes: actions travel down the answer stream
 * inside an envelope delimited by two control characters, and the client
 * unpacks whatever it finds between them. Nothing checked that an envelope had
 * actually been written by the server. A page carrying a literal envelope,
 * echoed back by the model, would be carried out as though it had been planned
 * here — the host-approval check catches that for opening a site, and nothing
 * catches it for playing music, opening a module or changing the volume.
 *
 * So the characters an envelope is made of never reach the model at all.
 */

/** The only invisible characters that are ordinary punctuation in prose. */
const KEPT = new Set(["\t", "\n", "\r"]);

/**
 * Removes what a person cannot see and a machine would obey.
 *
 * Done by character code rather than by a pattern: a range of control
 * characters written into a regular expression is precisely the escape that
 * has arrived here mangled twice in one session, and a remover containing the
 * disease it removes would be a poor joke.
 */
export function stripControlCharacters(text: string): string {
  let clean = "";
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    if (code === 127) continue;
    if (code < 32 && !KEPT.has(character)) continue;
    clean += character;
  }
  return clean;
}
