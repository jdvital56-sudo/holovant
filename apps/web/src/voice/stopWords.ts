import { bareWords } from "./echo";

/**
 * The words that stop the voice.
 *
 * Pulled out of the hook so they can be checked without a browser. He reported
 * saying "Стоп! Остановись!" into a long answer and being read to anyway, and
 * the first thing to rule out is whether the words themselves are recognised —
 * a question a test answers in a millisecond and a person answers by talking
 * to a machine and guessing.
 */
/** Any of these, said alone or inside a phrase, stops the voice at once. */
const STOP_WORDS = [
  "стоп",
  "стой",
  "стойте",
  // He said "стоп или остановись" and only the first was listed.
  "остановись",
  "остановитесь",
  "прекрати",
  "прекратите",
  "отмена",
  "stop",
  "cancel",
  "enough",
  "хватит",
  "замолчи",
  "замолкни",
  "замолчите",
  "молчи",
  "помолчи",
  "тихо",
];

export function isStopCommand(raw: string): boolean {
  const words = bareWords(raw);
  return words.some((w) => STOP_WORDS.includes(w));
}

/** Words that only join two orders together and mean nothing on their own. */
const JOINERS = ["и", "а", "потом", "ещё", "еще", "также", "and", "then", "also"];

/**
 * What is left of a phrase once the order to stop has been taken out of it.
 *
 * He said "стоп и закрой лицо" and the voice stopped with the face still up.
 * Stopping was checked first and returned immediately, so the second half of
 * the sentence was never looked at — one order in a phrase carrying two.
 *
 * @returns the remaining order, or an empty string when stopping was all of it
 */
export function withoutStopWords(raw: string): string {
  const words = bareWords(raw).filter((word) => !STOP_WORDS.includes(word));
  // A joiner left at the front is the seam where the first order was removed.
  while (words.length && JOINERS.includes(words[0])) words.shift();
  return words.join(" ");
}
