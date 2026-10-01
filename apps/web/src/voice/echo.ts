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

/**
 * Above this share of words found as a run, the line is the assistant quoting
 * itself.
 *
 * It used to be half the words found anywhere — and "anywhere" meant anywhere
 * in the text, as a substring: "есть" was found inside "шесть", "проекты"
 * beside "проектов", and "какие у нас есть проекты", asked straight after an
 * answer about projects, was thrown away as an echo. He reported it as the
 * assistant not answering at all. What actually separates echo from a
 * follow-up is order: an echo is the assistant's words in the order it said
 * them; a question on the same subject uses some of the same words in an order
 * of its own.
 */
const ECHO_SHARE = 0.6;

/** Right after it stops, the bar is higher: a short phrase must match almost whole. */
const TAIL_SHARE = 0.75;

/** Words of one or two letters carry no meaning on their own. */
const contentWords = (raw: string) => bareWords(raw).filter((w) => w.length > 2);

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

  const heard = contentWords(heardRaw);
  if (!heard.length) return true;
  if (heard.length < MIN_WORDS_TO_JUDGE) return false;

  // No limit on the gaps here. A recogniser repeating a long reply drops
  // whole clauses — "Давайте уточним … что именно анализировать" skipped a
  // quoted sentence in between — and order alone is enough at four words or
  // more: a question on the same subject does not contain the reply's words
  // in the reply's order.
  return longestRun(heard, contentWords(spokenRaw), Infinity) / heard.length >= ECHO_SHARE;
}

/**
 * Whether what was just heard is the tail of what the assistant just said.
 *
 * For the second or two after it stops, when the recogniser is still handing
 * over the transcript of its own last words. Everything heard in that window
 * used to be discarded, which also discarded every short question asked
 * straight after an answer — "что ты умеешь" fits inside it whole. Here a
 * phrase of any length is judged, but it must be a run of the assistant's own
 * words, nearly all of them, in its order.
 */
export function isTailOfSpeech(heardRaw: string, justSaidRaw: string): boolean {
  if (!justSaidRaw.trim()) return false;
  const heard = contentWords(heardRaw);
  // Nothing with meaning in it: a breath, "а", "ну". Not a question.
  if (!heard.length) return true;
  // Short phrases find their words scattered across any long answer, so here
  // they must also sit close together, as a fragment of speech does.
  const span = heard.length * 2 + 2;
  return longestRun(heard, contentWords(justSaidRaw), span) / heard.length >= TAIL_SHARE;
}

/**
 * How many of the heard words appear in the spoken ones in the same order,
 * each within `span` words of where the match began, allowing for the odd word
 * the recogniser got wrong or added.
 */
function longestRun(heard: string[], spoken: string[], span: number): number {
  let best = 0;
  for (let start = 0; start < spoken.length; start++) {
    let matched = 0;
    let at = start;
    const limit = Math.min(spoken.length, start + span);
    for (const word of heard) {
      for (let j = at; j < limit; j++) {
        if (sameWord(word, spoken[j])) {
          matched++;
          at = j + 1;
          break;
        }
      }
    }
    best = Math.max(best, matched);
  }
  return best;
}

/**
 * The same word, perhaps in another form.
 *
 * Whole words only. A long word may contain the other — "проанализировать"
 * heard where "анализировать" was said — but a short one never counts as part
 * of another: that was how "есть" matched "шесть".
 */
function sameWord(a: string, b: string): boolean {
  if (sharesStem(a, b)) return true;
  return a.length >= 6 && b.length >= 6 && (a.includes(b) || b.includes(a));
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
