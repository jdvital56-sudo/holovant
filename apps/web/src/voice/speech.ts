"use client";

/**
 * Spoken replies via the browser's own synthesiser. No API key, no account and
 * no network call — so the system can answer out loud before any AI service is
 * wired up, and keeps answering if one never is.
 */

import { meterAudioElement } from "@/audio/voiceLevel";
import { getVolume } from "@/audio/volumeStore";
import { duckMusic } from "./playMusic";
import { forSpeech, forVoice, type SpeechLang } from "./speechText";
import { armWatchdog } from "./speakingWatchdog";
import { createSynthCache } from "./synthCache";

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
      if (response.status === 501) {
        serverVoiceAvailable = false;
        return;
      }
      return preloadEverydayLines();
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

/** A sentence is synthesised in 270-450 ms; this is far outside that. */
const SPEAK_REQUEST_TIMEOUT_MS = 6000;

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
    duckMusic(false);
  }, ECHO_TAIL_MS);
}

let currentAudio: HTMLAudioElement | null = null;
/** Rising id, so a slow reply cannot start playing after a newer one has. */
let speechSequence = 0;

/** The reply already playing, so a volume change is heard now, not next time. */
export function applyVolumeNow(level: number) {
  if (currentAudio) currentAudio.volume = level;
}

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
/** One synthesis request. Null on any failure, so the caller falls back. */
async function requestAudio(text: string): Promise<Blob | null> {
  if (!serverVoiceAvailable) return null;
  const response = await fetch("/api/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    // Measured on this machine: a sentence is synthesised in 270-450 ms and
    // the longest paragraph in about 1.8 s. Without a deadline here a
    // stalled worker never answers, `speaking` is never lowered, and every
    // question after it is dropped — the microphone goes deaf for the rest
    // of the session with nothing on screen to say why.
    signal: AbortSignal.timeout(SPEAK_REQUEST_TIMEOUT_MS),
  });
  if (response.status === 501) {
    // Not configured — a permanent answer, so stop asking every time.
    serverVoiceAvailable = false;
    return null;
  }
  if (!response.ok) return null;
  return response.blob();
}

const synth = createSynthCache(requestAudio);

/**
 * Asks for a line ahead of time, so it is ready the moment the one playing
 * ends. At most one line ahead: an answer cut off by "стоп" then leaves one
 * wasted synthesis in the worker's queue, not the whole tail of the answer
 * sitting in front of the next reply.
 */
function prefetch(text: string | undefined) {
  if (text && serverVoiceAvailable) void synth.get(text);
}

/**
 * The lines said over and over, ready before they are needed. Synthesised one
 * at a time after the voice has warmed, so they never queue in front of a
 * question asked in the first seconds.
 */
const EVERYDAY_LINES: Record<SpeechLang, string[]> = {
  ru: [
    "Секунду, проверяю",
    "Не понял команду",
    "Сейчас ничего не играет",
    "Нечего продолжать",
    "Ничего не нашёл",
    "Выключаю музыку",
  ],
  en: ["One moment, checking", "Did not catch that", "Nothing is playing"],
};

async function preloadEverydayLines() {
  for (const lang of ["ru", "en"] as const) {
    for (const line of EVERYDAY_LINES[lang]) {
      if (!serverVoiceAvailable) return;
      // The key is what will actually be asked for, which is the line after
      // forVoice has done its work on it.
      const key = forVoice(line, lang);
      synth.keep(key);
      await synth.get(key);
    }
  }
}

async function speakOnServer(text: string, sequence: number): Promise<boolean> {
  if (!serverVoiceAvailable) return false;
  try {
    const blob = await synth.get(text);
    // Played once and done with, unless it is one of the everyday lines.
    synth.forget(text);
    if (!blob) return false;

    // A newer line was requested while this one was being synthesised.
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
  // Music through the speakers competes with the assistant and with the
  // microphone. It steps back while there is something to hear.
  duckMusic(true);
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
  // Something is already playing and this is next: start making it now, so
  // there is no silence at the join.
  if (draining && queue.length === 1) prefetch(trimmed);
  speaking = true;
  duckMusic(true);
  void drain();
}

async function drain() {
  if (draining) return;
  draining = true;
  try {
    while (queue.length) {
      const next = queue.shift();
      if (!next) break;
      // The line after this one is made while this one plays.
      prefetch(queue[0]?.text);
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
  // Nothing below is guaranteed to finish: a request can stall past its own
  // deadline, and audio that never starts never ends. The latch lets go by
  // itself rather than waiting for a path nobody thought of.
  const disarm = armWatchdog(markDone);
  try {
    const playedOnServer = await speakOnServer(text, sequence);
    if (sequence !== speechSequence) return;
    if (playedOnServer) {
      await waitForCurrentAudio();
      return;
    }
    await speakInBrowserAwaited(text, lang);
  } finally {
    disarm();
  }
}

function waitForCurrentAudio(): Promise<void> {
  const audio = currentAudio;
  // A short clip can finish between play() resolving and this line running;
  // its "ended" has then already fired, and waiting for it would wait forever.
  if (!audio || audio.ended) return Promise.resolve();
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
  // The rest of a cut-off answer will not be said; its audio is not kept.
  synth.dropTransient();
  // What was said is deliberately kept: the microphone is still carrying the
  // tail of it, and that tail is exactly what must not be taken as a question.
  stopServerVoice();
  speaking = false;
  speechEndedAt = Date.now();
  duckMusic(false);
  if (settleTimer) clearTimeout(settleTimer);
  if (isSpeechSynthesisAvailable()) window.speechSynthesis.cancel();
}
