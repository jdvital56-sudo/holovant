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
 * Below this many significant words, nothing is called an echo.
 *
 * "Закрой лицо" is two words. If either appeared anywhere in the last minute of
 * speech — and "лицо" certainly did, since the face was just discussed — half
 * the words match and the command was thrown away as the assistant quoting
 * itself. Echo arrives as fragments of sentences, never as a two-word order, so
 * short phrases are exempt and commands stop being eaten by their own subject.
 */
const MIN_WORDS_TO_JUDGE = 4;

/**
 * @param heardRaw what the recogniser reported
 * @param spokenRaw everything the assistant has said recently, joined
 */
export function isEchoOfSpeech(heardRaw: string, spokenRaw: string): boolean {
  if (!spokenRaw.trim()) return false;

  const heard = bareWords(heardRaw).filter((w) => w.length > 2);
  if (!heard.length) return true;
  if (heard.length < MIN_WORDS_TO_JUDGE) return false;

  const spoken = spokenRaw.toLowerCase();
  const spokenWords = bareWords(spoken);

  const matched = heard.filter(
    (w) => spoken.includes(w) || spokenWords.some((sw) => sharesStem(w, sw)),
  ).length;

  return matched / heard.length >= ECHO_SHARE;
}

/** Enough of a word to identify it before Russian changes the ending. */
const STEM_LENGTH = 5;

/**
 * Whether two words are the same word in different grammatical forms.
 *
 * Compared by their opening letters, because inflection changes the end and
 * leaves the start alone: "положение" and "положении", "подробно" and
 * "подробнее". Containment does not see these — neither string contains the
 * other — so a recogniser hearing one where the assistant said the other used
 * to count as a different word entirely, and a genuine echo slipped through.
 */
function sharesStem(a: string, b: string): boolean {
  const length = Math.min(STEM_LENGTH, a.length, b.length);
  if (length < STEM_LENGTH) return a === b;
  return a.slice(0, length) === b.slice(0, length);
}
