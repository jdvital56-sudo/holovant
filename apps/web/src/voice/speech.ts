"use client";

/**
 * Spoken replies via the browser's own synthesiser. No API key, no account and
 * no network call — so the system can answer out loud before any AI service is
 * wired up, and keeps answering if one never is.
 */

import { meterAudioElement } from "@/audio/voiceLevel";
import { getVolume } from "@/audio/volumeStore";
import { forSpeech, forVoice, type SpeechLang } from "./speechText";

export type { SpeechLang };
export { forSpeech, forVoice };

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

/** Set false once the server has said it cannot synthesise, so we stop asking. */
let serverVoiceAvailable = true;
let warmRequested = false;

/**
 * Asks the server to load its voice model now. Doing it on page load means the
 * several seconds it takes are spent while the user is still looking at the
 * scene, instead of landing on the first thing they say.
 */
export function warmUpServerVoice() {
  if (warmRequested || typeof window === "undefined") return;
  warmRequested = true;
  void fetch("/api/speak", { method: "GET" })
    .then((response) => {
      if (response.status === 501) serverVoiceAvailable = false;
    })
    .catch(() => {
      // Warming is best-effort; speaking will retry and fall back on its own.
    });
}

/**
 * The API exposes no gender field, so male voices are identified by name.
 * These are the ones actually shipped on Windows and Chrome; anything not
 * listed falls back to whatever voice matches the language.
 */
const MALE_VOICE_NAMES: Record<SpeechLang, string[]> = {
  ru: ["pavel", "dmitry", "yuri", "russian male"],
  en: ["david", "mark", "george", "guy", "christopher", "male"],
};

const FEMALE_VOICE_HINTS = ["irina", "svetlana", "zira", "hazel", "female", "aria", "jenny"];

function pickVoice(lang: SpeechLang): SpeechSynthesisVoice | null {
  const wanted = lang === "ru" ? "ru" : "en";
  const matching = getVoices().filter((v) => v.lang.toLowerCase().startsWith(wanted));
  if (!matching.length) return null;

  const named = matching.find((v) =>
    MALE_VOICE_NAMES[lang].some((n) => v.name.toLowerCase().includes(n)),
  );
  if (named) return named;

  // No known male voice installed — at least avoid the obviously female ones.
  const notFemale = matching.find(
    (v) => !FEMALE_VOICE_HINTS.some((n) => v.name.toLowerCase().includes(n)),
  );
  return notFemale ?? matching[0];
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

/**
 * Everything said in the last minute, lowercased.
 *
 * A rolling window rather than the last line, because a recogniser does not
 * hand over a final transcript until it hears a pause — which lands a second
 * or two *after* the audio stopped, when the assistant is no longer speaking
 * and the naive guard has already been lifted. That gap is how its own answer
 * came back as a question and started a conversation with itself.
 */
let recentlySpoken: Array<{ text: string; at: number }> = [];
const RECENT_WINDOW_MS = 60_000;

function rememberSpoken(text: string) {
  const now = Date.now();
  recentlySpoken.push({ text: text.toLowerCase(), at: now });
  recentlySpoken = recentlySpoken.filter((r) => now - r.at < RECENT_WINDOW_MS);
}

export function recentSpokenText(): string {
  const now = Date.now();
  return recentlySpoken
    .filter((r) => now - r.at < RECENT_WINDOW_MS)
    .map((r) => r.text)
    .join(" ");
}

/** When the voice last fell silent. The tail of a sentence keeps arriving
 *  through the microphone for a moment after this. */
let speechEndedAt = 0;

export function msSinceSpeechEnded(): number {
  if (speaking) return 0;
  return speechEndedAt ? Date.now() - speechEndedAt : Number.MAX_SAFE_INTEGER;
}

function markDone() {
  if (settleTimer) clearTimeout(settleTimer);
  settleTimer = setTimeout(() => {
    speaking = false;
    speechEndedAt = Date.now();
  }, ECHO_TAIL_MS);
}

let currentAudio: HTMLAudioElement | null = null;
/** Rising id, so a slow reply cannot start playing after a newer one has. */
let speechSequence = 0;

function stopServerVoice() {
  if (!currentAudio) return;
  currentAudio.onended = null;
  currentAudio.onerror = null;
  currentAudio.pause();
  URL.revokeObjectURL(currentAudio.src);
  currentAudio = null;
}

/**
 * Speaks through the server's own voice, which sounds the same for every user
 * regardless of what their browser or operating system happens to ship.
 * Returns false when the server cannot do it, so the caller can fall back.
 */
async function speakOnServer(text: string, sequence: number): Promise<boolean> {
  if (!serverVoiceAvailable) return false;
  try {
    const response = await fetch("/api/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (response.status === 501) {
      // Not configured — a permanent answer, so stop asking every time.
      serverVoiceAvailable = false;
      return false;
    }
    if (!response.ok) return false;

    // A newer line was requested while this one was being synthesised.
    if (sequence !== speechSequence) return true;

    const blob = await response.blob();
    if (sequence !== speechSequence) return true;

    stopServerVoice();
    const audio = new Audio(URL.createObjectURL(blob));
    audio.volume = getVolume();
    // Routed through the meter so the face moves to this line, not to a timer.
    meterAudioElement(audio);
    currentAudio = audio;
    speaking = true;
    audio.onended = markDone;
    audio.onerror = markDone;
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

/**
 * Speaks a line, cutting off whatever was being said. Replies are short status
 * confirmations, so a queued backlog would leave the system narrating actions
 * the user took several seconds ago.
 *
 * The server voice is tried first and the browser's own is the fallback, so
 * the product still talks on a deployment with no speech service behind it.
 */
export function speak(text: string, lang: SpeechLang = "ru") {
  const clean = forVoice(text ?? "", lang);
  if (!clean) return;
  queue.length = 0;
  const sequence = ++speechSequence;
  stopServerVoice();
  if (isSpeechSynthesisAvailable()) window.speechSynthesis.cancel();
  // Held from the moment the line is requested, not from when audio starts, so
  // the microphone cannot pick up the reply during synthesis either.
  speaking = true;
  void deliver(clean, lang, sequence);
}

const queue: Array<{ text: string; lang: SpeechLang }> = [];
let draining = false;

/**
 * Speaks a line after everything already waiting, instead of replacing it.
 *
 * A streamed answer arrives a sentence at a time; interrupting on each one
 * would leave only the last sentence audible. Interruption is still the right
 * behaviour for one-off confirmations, which is what `speak` is for.
 */
export function speakQueued(text: string, lang: SpeechLang = "ru") {
  const trimmed = forVoice(text ?? "", lang);
  if (!trimmed) return;
  queue.push({ text: trimmed, lang });
  speaking = true;
  void drain();
}

async function drain() {
  if (draining) return;
  draining = true;
  try {
    while (queue.length) {
      const next = queue.shift();
      if (!next) break;
      const sequence = speechSequence;
      await deliver(next.text, next.lang, sequence);
      // A newer interruption bumped the sequence; the rest of this answer is
      // no longer wanted.
      if (sequence !== speechSequence) {
        queue.length = 0;
        break;
      }
    }
  } finally {
    draining = false;
  }
}

/** Speaks one line and resolves when its audio has finished, not when it starts. */
async function deliver(text: string, lang: SpeechLang, sequence: number): Promise<void> {
  rememberSpoken(text);
  const playedOnServer = await speakOnServer(text, sequence);
  if (sequence !== speechSequence) return;
  if (playedOnServer) {
    await waitForCurrentAudio();
    return;
  }
  await speakInBrowserAwaited(text, lang);
}

function waitForCurrentAudio(): Promise<void> {
  const audio = currentAudio;
  if (!audio) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => resolve();
    audio.addEventListener("ended", finish, { once: true });
    audio.addEventListener("error", finish, { once: true });
  });
}

function speakInBrowserAwaited(text: string, lang: SpeechLang): Promise<void> {
  return new Promise((resolve) => {
    if (!isSpeechSynthesisAvailable()) {
      markDone();
      resolve();
      return;
    }
    const synth = window.speechSynthesis;
    const utterance = buildUtterance(text, lang);
    utterance.onend = () => {
      markDone();
      resolve();
    };
    utterance.onerror = () => {
      markDone();
      resolve();
    };
    synth.speak(utterance);
  });
}

function buildUtterance(text: string, lang: SpeechLang) {
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(lang);
  if (voice) utterance.voice = voice;
  utterance.lang = lang === "ru" ? "ru-RU" : "en-US";
  utterance.rate = 1.02;
  // Just under neutral — enough to lean male without sounding sunk.
  utterance.pitch = 0.95;
  utterance.volume = getVolume();

  // Held so the recogniser does not hear the reply and act on it — "Opening
  // Instagram" contains the very word that opens Instagram.
  speaking = true;
  if (settleTimer) clearTimeout(settleTimer);
  return utterance;
}

export function stopSpeaking() {
  speechSequence++;
  queue.length = 0;
  // What was said is deliberately kept: the microphone is still carrying the
  // tail of it, and that tail is exactly what must not be taken as a question.
  stopServerVoice();
  speaking = false;
  speechEndedAt = Date.now();
  if (settleTimer) clearTimeout(settleTimer);
  if (isSpeechSynthesisAvailable()) window.speechSynthesis.cancel();
}
