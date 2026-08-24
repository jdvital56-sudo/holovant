"use client";

/**
 * Spoken replies via the browser's own synthesiser. No API key, no account and
 * no network call — so the system can answer out loud before any AI service is
 * wired up, and keeps answering if one never is.
 */

export type SpeechLang = "ru" | "en";

let cachedVoices: SpeechSynthesisVoice[] = [];

export function isSpeechSynthesisAvailable() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Voices load asynchronously in Chrome; the first call often sees an empty list. */
function getVoices(): SpeechSynthesisVoice[] {
  if (!isSpeechSynthesisAvailable()) return [];
  const voices = window.speechSynthesis.getVoices();
  if (voices.length) cachedVoices = voices;
  return cachedVoices;
}

export function primeVoices() {
  if (!isSpeechSynthesisAvailable()) return;
  getVoices();
  window.speechSynthesis.onvoiceschanged = () => getVoices();
}

function pickVoice(lang: SpeechLang): SpeechSynthesisVoice | null {
  const wanted = lang === "ru" ? "ru" : "en";
  const voices = getVoices();
  return voices.find((v) => v.lang.toLowerCase().startsWith(wanted)) ?? null;
}

/**
 * Tracked here rather than read from `speechSynthesis.speaking`, which reports
 * false during the gap between utterances and lags after one finishes.
 */
let speaking = false;
let settleTimer: ReturnType<typeof setTimeout> | null = null;

/** Microphone stays deaf this long after a reply, to miss its own echo. */
const ECHO_TAIL_MS = 500;

export function isSystemSpeaking() {
  return speaking;
}

function markDone() {
  if (settleTimer) clearTimeout(settleTimer);
  settleTimer = setTimeout(() => {
    speaking = false;
  }, ECHO_TAIL_MS);
}

/**
 * Speaks a line, cutting off whatever was being said. Replies are short status
 * confirmations, so a queued backlog would leave the system narrating actions
 * the user took several seconds ago.
 */
export function speak(text: string, lang: SpeechLang = "ru") {
  if (!isSpeechSynthesisAvailable() || !text) return;
  const synth = window.speechSynthesis;
  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(lang);
  if (voice) utterance.voice = voice;
  utterance.lang = lang === "ru" ? "ru-RU" : "en-US";
  utterance.rate = 1.05;
  utterance.pitch = 1;
  utterance.volume = 0.9;

  // Without this the recogniser hears the reply and acts on it — "Opening
  // Instagram" contains the very word that opens Instagram.
  speaking = true;
  if (settleTimer) clearTimeout(settleTimer);
  utterance.onend = markDone;
  utterance.onerror = markDone;

  synth.speak(utterance);
}

export function stopSpeaking() {
  if (!isSpeechSynthesisAvailable()) return;
  window.speechSynthesis.cancel();
  speaking = false;
  if (settleTimer) clearTimeout(settleTimer);
}
