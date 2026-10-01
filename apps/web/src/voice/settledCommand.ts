import { matchIntent, type VoiceIntent } from "./commandEngine";
import { bareWords } from "./echo";

/**
 * Carrying out a command before the recogniser calls the sentence finished.
 *
 * Chrome hands over a final transcript only once it hears silence. With music
 * playing there is no silence, and while the assistant is talking there is
 * none either, so "пауза", "сделай тише", "закрой", "убери лицо" sat on screen
 * as partial results and nothing happened until the noise stopped — he
 * reported exactly that: "ничего не происходит, идёт какая-то задержка".
 * Commands were only ever acted on from the final transcript.
 *
 * Two cases now:
 * - over music, a command complete in itself is carried out once its partial
 *   has held still for a moment;
 * - over the assistant's own voice the partial never holds still, because its
 *   words keep arriving, so a command in the last few words is carried out at
 *   once — unless those words are the assistant's own.
 *
 * Not every command: "включи …" waits for the whole title, or music would start
 * on its first word. And never twice: the same command arriving again — as the
 * final transcript, or as a partial that grew — is skipped.
 */

/** How long a partial must hold still before it counts as said. */
export const SETTLE_MS = 700;

/** Within this, the same command again is the same command arriving twice. */
export const REPEAT_MS = 3000;

/** He says a command at the end of what has been heard so far. */
const COMMAND_TAIL_WORDS = 4;

/** Complete in themselves; nothing more can follow that changes them. */
const SETTLES: ReadonlySet<VoiceIntent["kind"]> = new Set([
  "open",
  "close",
  "rotate",
  "pause",
  "resume",
  "next",
  "volume",
  "showFace",
  "dismiss",
]);

/** Whether a partial result naming this command may be acted on before it is final. */
export function canActOnPartial(intent: VoiceIntent | null): boolean {
  return intent !== null && SETTLES.has(intent.kind);
}

/**
 * The command at the end of a partial heard over the assistant's voice, if
 * there is one.
 *
 * Found from the longest ending that is a command, then trimmed for as long as
 * it still means the same thing. Neither extreme works alone: the longest
 * carries the assistant's own words in with it ("двадцать семь убери лицо"),
 * and the shortest can mean the opposite — "лицо" on its own is "покажи лицо".
 */
export function commandAtEnd(text: string): string | null {
  const words = bareWords(text);
  for (let n = Math.min(COMMAND_TAIL_WORDS, words.length); n >= 1; n--) {
    const intent = matchIntent(words.slice(-n).join(" "));
    if (!canActOnPartial(intent)) continue;
    const key = intentKey(intent!);
    let shortest = n;
    for (let m = n - 1; m >= 1; m--) {
      const shorter = matchIntent(words.slice(-m).join(" "));
      if (!shorter || intentKey(shorter) !== key) break;
      shortest = m;
    }
    return words.slice(-shortest).join(" ");
  }
  return null;
}

/**
 * What a command does, as a comparable key: "сделай громче" and "громче,
 * пожалуйста" are one command, and the label is left out because it echoes
 * the words.
 */
export function intentKey(intent: VoiceIntent): string {
  return JSON.stringify(intent, (key, value) => (key === "label" ? undefined : value));
}

export interface RunRecord {
  key: string;
  at: number;
}

/** Whether this command is the one just carried out, arriving again. */
export function isRepeatOf(last: RunRecord | null, intent: VoiceIntent | null, now: number): boolean {
  return intent !== null && last !== null && now - last.at < REPEAT_MS && last.key === intentKey(intent);
}
