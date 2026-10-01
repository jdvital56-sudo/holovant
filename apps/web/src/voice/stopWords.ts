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
  // Imperatives the assistant never says to him, so its own voice coming back
  // through the microphone cannot stop it. "Достаточно" and "хватит" sound
  // the same in his mouth, but the assistant says "достаточно" itself.
  "подожди",
  "погоди",
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

/** The same "стоп" arrives twice: once in a partial result, once in the final. */
export const REPEATED_STOP_MS = 4000;

export interface StopContext {
  /** What he said besides the stop word, if anything. */
  rest: string;
  /** Whether that rest is a command the app can carry out itself. */
  restIsCommand: boolean;
  /** Whether that rest is the assistant's own voice coming back. */
  restIsEcho: boolean;
  /** Final transcript, rather than a partial still growing word by word. */
  isFinal: boolean;
  msSinceLastStop: number;
}

/**
 * What to do after stopping, once the voice is silent.
 *
 * He asked for it in so many words: "стоп" must cut it off at once and answer
 * «Да, слушаю вас». It used to cut off and say nothing, which from across the
 * room cannot be told from not having heard — so he said it again, and it
 * carried on reading.
 *
 * - a command after the stop is carried out: "стоп и закрой лицо";
 * - a question after it is asked: "стоп, какие у нас проекты" — but only from
 *   the final transcript, never a partial, or it would be asked "какие у";
 * - otherwise it says it is listening, once, not again when the final
 *   transcript of the same "стоп" arrives a second later.
 */
export function afterStop(c: StopContext): "command" | "question" | "acknowledge" | "silent" {
  if (c.rest && c.restIsCommand) return "command";
  if (c.isFinal && c.rest && !c.restIsEcho && c.rest.split(/\s+/).length >= 2) return "question";
  if (c.msSinceLastStop < REPEATED_STOP_MS) return "silent";
  return "acknowledge";
}
