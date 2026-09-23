import type { SpeechLang } from "./speechText";

/**
 * What to do when the browser's recogniser reports an error.
 *
 * It used to do one thing for all of them: set `wantsRunning` to false, throw
 * the recogniser away and put a line of English in the corner of the screen.
 * Chrome raises `aborted` routinely — cutting the voice mid-sentence is enough
 * to cause one — so the microphone died within a minute or two of being turned
 * on and never came back. From the outside that is an assistant that obeys the
 * first two commands and then goes deaf, which is exactly how he described it:
 * music plays, the face appears, and after that nothing is heard at all.
 *
 * Almost every code is worth another try. The two that are not are the two
 * that retrying cannot possibly fix — the microphone being refused — and those
 * have to say so, in the language he is using.
 */

export type Recovery =
  | { action: "retry"; delayMs: number; message: null }
  /** Retrying cannot help, or has been tried enough. Say why and stay off. */
  | { action: "give-up"; message: string };

/** Silence, and an abort we caused ourselves: not failures at all. */
const HARMLESS = new Set(["no-speech", "aborted"]);

/** The microphone is refused. No number of retries changes that. */
const REFUSED = new Set(["not-allowed", "service-not-allowed"]);

/** How many times in a row a recoverable fault is retried before giving up. */
export const MAX_RETRIES = 5;

/**
 * @param code the browser's error code
 * @param consecutiveFailures how many have happened in a row without the
 *   recogniser reporting a result in between — the count resets on success
 */
export function recoveryFor(
  code: string,
  consecutiveFailures: number,
  lang: SpeechLang,
): Recovery {
  const ru = lang === "ru";

  if (REFUSED.has(code)) {
    return {
      action: "give-up",
      message: ru
        ? "Микрофон запрещён. Разрешите доступ в настройках браузера и включите голос снова."
        : "The microphone is blocked. Allow it in the browser and turn the voice back on.",
    };
  }

  // Harmless codes are not failures and do not count towards giving up:
  // silence during a pause would otherwise use up every retry by itself.
  if (HARMLESS.has(code)) return { action: "retry", delayMs: 0, message: null };

  if (consecutiveFailures >= MAX_RETRIES) {
    if (code === "audio-capture") {
      return {
        action: "give-up",
        message: ru ? "Микрофон не найден." : "No microphone found.",
      };
    }
    if (code === "network") {
      return {
        action: "give-up",
        message: ru
          ? "Распознаванию речи нужна сеть, а её нет."
          : "Speech recognition needs a network connection.",
      };
    }
    return {
      action: "give-up",
      // The code is kept: it is the one thing he can read back to me.
      message: ru
        ? `Распознавание речи не запускается (${code}).`
        : `Speech recognition will not start (${code}).`,
    };
  }

  // Backoff, so a microphone that is genuinely gone is not hammered: 400ms,
  // 800, 1600, and so on.
  return { action: "retry", delayMs: 400 * 2 ** consecutiveFailures, message: null };
}
