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
