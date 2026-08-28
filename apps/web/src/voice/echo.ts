/**
 * Telling the assistant's own voice from the user's.
 *
 * The microphone hears every word the assistant says. A recogniser withholds a
 * final transcript until it hears a pause, so that text arrives a second or two
 * *after* the audio stopped — when a guard keyed to "is it speaking right now"
 * has already lifted. The reply then arrives as a question, is answered, and
 * the answer is heard again: the system holds a conversation with itself.
 *
 * Pure and separate from the recogniser so it can be tested against the
 * transcripts that actually got through.
 */

export function bareWords(raw: string): string[] {
  return raw
    .toLowerCase()
    .replace(/[.,!?;:"'()«»—–]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Above this share of matched words, the line is the assistant quoting itself. */
const ECHO_SHARE = 0.5;

/**
 * @param heardRaw what the recogniser reported
 * @param spokenRaw everything the assistant has said recently, joined
 */
export function isEchoOfSpeech(heardRaw: string, spokenRaw: string): boolean {
  if (!spokenRaw.trim()) return false;

  const heard = bareWords(heardRaw).filter((w) => w.length > 2);
  if (!heard.length) return true;

  const spoken = spokenRaw.toLowerCase();
  const spokenWords = bareWords(spoken).filter((w) => w.length >= 5);

  const matched = heard.filter(
    (w) =>
      spoken.includes(w) ||
      // A recogniser hears "проанализировать" where "анализировать" was said.
      // Containment the other way catches the endings Russian adds and drops.
      spokenWords.some((sw) => w.includes(sw)),
  ).length;

  return matched / heard.length >= ECHO_SHARE;
}
