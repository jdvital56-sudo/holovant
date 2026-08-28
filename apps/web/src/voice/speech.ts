"use client";

/**
 * Spoken replies via the browser's own synthesiser. No API key, no account and
 * no network call — so the system can answer out loud before any AI service is
 * wired up, and keeps answering if one never is.
 */

import { meterAudioElement } from "@/audio/voiceLevel";
import { getVolume } from "@/audio/volumeStore";

export type SpeechLang = "ru" | "en";

/**
 * Strips formatting a synthesiser would read out as the names of punctuation.
 * The model answers in Markdown — "**bold**", "- point", "— aside", "### head"
 * — and both Piper and the browser voice will literally say "звёздочка",
 * "тире", "решётка" for those. This keeps the words and drops the marks.
 */
export function forSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ") // fenced code
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links -> their text
    .replace(/^\s{0,3}#{1,6}\s+/gm, "") // headings
    .replace(/^\s{0,3}>\s?/gm, "") // block quotes
    .replace(/^\s{0,3}[-*+•·—–]\s+/gm, "") // bullet markers
    .replace(/^\s{0,3}\d+[.)]\s+/gm, "") // numbered list markers
    .replace(/\*\*([^*]+)\*\*/g, "$1") // bold
    .replace(/\*([^*]+)\*/g, "$1") // italic *
    .replace(/(^|[\s(])_([^_]+)_(?=[\s).,!?:;]|$)/g, "$1$2") // italic _
    .replace(/[*_`#|~]/g, " ") // any leftover markup character
    .replace(/\s*[—–]\s*/g, ", ") // dash used as an aside -> a pause
    .replace(/\s+-\s+/g, ", ") // hyphen used the same way
    .replace(/\.{2,}/g, "…") // "..." read as three separate stops
    .replace(/,\s*,/g, ",")
    .replace(/\s+([,.!?;:…])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/**
 * Turns figures into something a synthesiser says as a person would.
 *
 * "$80,270" was read out as "знак доллара восемьдесят запятая двести семьдесят",
 * and "44.48" as "сорок четыре точка сорок восемь". The separators and symbols
 * are punctuation to the voice and quantity to the listener, so they are
 * resolved into words here rather than left for it to guess.
 *
 * Speech only. The panel keeps "$80,270", which is what is readable on screen.
 */
export function forVoice(text: string, lang: SpeechLang = "ru"): string {
  const ru = lang === "ru";
  let out = forSpeech(text);

  // Thousands separators first, so a grouped number is one quantity before
  // anything looks for a decimal point in it.
  for (let pass = 0; pass < 3; pass++) {
    out = out.replace(/(\d),(\d{3})\b/g, "$1$2").replace(/(\d)[  ](\d{3})\b/g, "$1$2");
  }

  // Currency and units, before the decimal split so "$44.48" keeps its symbol
  // attached to the whole figure.
  // The whole figure is captured, not its first digit: "$100" must not become
  // "1 долларов 00".
  const AMOUNT = String.raw`(\d+(?:[.,]\d+)?)`;
  out = out
    .replace(new RegExp(`\\$\\s?${AMOUNT}`, "g"), ru ? "$1 долларов" : "$1 dollars")
    .replace(new RegExp(`€\\s?${AMOUNT}`, "g"), ru ? "$1 евро" : "$1 euros")
    .replace(new RegExp(`₴\\s?${AMOUNT}`, "g"), ru ? "$1 гривен" : "$1 hryvnia")
    .replace(new RegExp(`£\\s?${AMOUNT}`, "g"), ru ? "$1 фунтов" : "$1 pounds");

  // And the same symbols written after the figure, which is how they appear in
  // Ukrainian and most European copy: "45,30 ₴".
  out = out
    .replace(new RegExp(`${AMOUNT}\\s?₴`, "g"), ru ? "$1 гривен" : "$1 hryvnia")
    .replace(new RegExp(`${AMOUNT}\\s?€`, "g"), ru ? "$1 евро" : "$1 euros")
    .replace(new RegExp(`${AMOUNT}\\s?\\$`, "g"), ru ? "$1 долларов" : "$1 dollars");

  // A trailing symbol reads as its name, not its punctuation.
  out = out
    .replace(/(\d)\s?%/g, ru ? "$1 процентов" : "$1 percent")
    .replace(/(\d)\s?°\s?[CС]/g, ru ? "$1 градусов" : "$1 degrees")
    .replace(/(\d)\s?°/g, ru ? "$1 градусов" : "$1 degrees");

  // The decimal separator itself. Said aloud a person joins the halves with a
  // word, never with the name of the mark between them.
  out = out.replace(/(\d+)[.,](\d+)/g, ru ? "$1 и $2" : "$1 point $2");

  return out.replace(/\s{2,}/g, " ").replace(/\s+([,.!?;:…])/g, "$1").trim();
}

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
 * The last line handed to the voice, lowercased. The microphone picks up the
 * reply while it plays; comparing against this is how the caller tells the
 * assistant's own echo from the user actually talking over it.
 */
let lastSpoken = "";
export function spokenText() {
  return lastSpoken;
}

function markDone() {
  if (settleTimer) clearTimeout(settleTimer);
  settleTimer = setTimeout(() => {
    speaking = false;
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
  lastSpoken = text.toLowerCase();
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
  lastSpoken = "";
  stopServerVoice();
  if (!isSpeechSynthesisAvailable()) {
    speaking = false;
    return;
  }
  window.speechSynthesis.cancel();
  speaking = false;
  if (settleTimer) clearTimeout(settleTimer);
}
