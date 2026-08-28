"use client";

import { useCallback, useEffect, useRef } from "react";
import { useOrbitStore } from "@/stores/orbitStore";
import { playBlip } from "@/audio/audioStore";
import { getSpeechRecognition, type SpeechRecognitionLike } from "./speechTypes";
import { matchIntent, replyFor } from "./commandEngine";
import { bareWords, isEchoOfSpeech } from "./echo";
import {
  speak,
  stopSpeaking,
  primeVoices,
  applyVolumeNow,
  isSystemSpeaking,
  recentSpokenText,
  msSinceSpeechEnded,
  type SpeechLang,
} from "./speech";
import { runSearch, clearSearch } from "./searchStore";
import {
  playTrack,
  playSavedTrack,
  usePlayStore,
  clearPlayback,
  commandPlayer,
  duckMusic,
} from "./playMusic";
import { addFavorite, nextFavorite } from "./favoritesStore";
import { showVita, hideVita } from "@/stores/vitaStore";
import { nudgeVolume } from "@/audio/volumeStore";
import { briefingFor, findModule } from "@/modules/briefing";
import { askAssistant, clearChat, useChatStore } from "./chatStore";

/** Below this a transcript is almost always a stray noise, not a question. */
const MIN_QUESTION_WORDS = 2;
import {
  useVoiceStore,
  setVoiceStatus,
  setTranscript,
  setLastCommand,
  setVoiceError,
} from "./voiceStore";

/** How long a recognised command stays on screen before the readout clears. */
const COMMAND_DISPLAY_MS = 2500;

/**
 * After the voice is cut, ignore everything heard for this long — it is the
 * tail of the sentence that was playing, arriving late through the microphone.
 */
const AFTER_STOP_DEAF_MS = 1200;

/**
 * Any of these, said alone or in a phrase, stops the voice at once. "тише" is
 * deliberately absent — it lowers the volume, it does not stop speech.
 */
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

function isStopCommand(raw: string): boolean {
  const words = bareWords(raw);
  return words.some((w) => STOP_WORDS.includes(w));
}

/**
 * A question is never accepted this soon after the voice stops. The recogniser
 * withholds a final transcript until it hears a pause, so the tail of a reply
 * arrives a second or two after the audio ended — by which time the assistant
 * is no longer "speaking" and every guard keyed to that has already lifted.
 */
const QUIET_AFTER_SPEECH_MS = 1800;

/** Past this, a repeat is the user asking again, not an echo. */
const ECHO_WINDOW_MS = 12_000;

/** Its own voice returning through the microphone, rather than the user. */
function isOwnEcho(raw: string): boolean {
  return isEchoOfSpeech(raw, recentSpokenText());
}

function describeError(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access denied — allow the microphone permission and try again.";
    case "no-speech":
      return "No speech detected.";
    case "audio-capture":
      return "No microphone found on this device.";
    case "network":
      return "Speech recognition needs a network connection.";
    default:
      return `Speech recognition failed (${code}).`;
  }
}

/**
 * Voice control for the commands the app can carry out by itself — opening a
 * module, turning the carousel, closing a panel. Deliberately independent of
 * any AI service: these work with no API key, no account and no network round
 * trip beyond what the browser's recogniser already does.
 */
export function useVoiceCommands() {
  const status = useVoiceStore((s) => s.status);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const wantsRunning = useRef(false);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Epoch ms until which recognition results are ignored (post-stop tail). */
  const deafUntil = useRef(0);
  /** Restores music volume once the person has stopped talking. */
  const unduckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runIntent = useCallback((transcript: string, lang: SpeechLang) => {
    const lower = transcript.trim().toLowerCase();

    // Music is playing and the user said something that sounds like "stop" —
    // stop the player, whatever the exact words. This is caught before the
    // matcher and the model so a "turn it off" phrase can never reach the
    // model, which will cheerfully claim the music stopped when it did not.
    const STOPPY = /выключ|выруб|останов|заглуш|глуши|убери|хватит|отключ|стоп|turn off|shut|stop|pause/;
    const aboutChatOrAll = /чат|ответ|chat|answer|вс[её]|everything|\ball\b/.test(lower);
    const aboutMusic =
      /музык|песн|трек|плеер|music|song|track|player|полност/.test(lower) ||
      lower.split(/\s+/).filter(Boolean).length <= 2;
    if (
      usePlayStore.getState().status !== "idle" &&
      STOPPY.test(lower) &&
      !aboutChatOrAll &&
      aboutMusic
    ) {
      clearPlayback();
      speak(lang === "ru" ? "Выключаю музыку" : "Stopping the music", lang);
      setLastCommand(lang === "ru" ? "музыка выкл." : "music off");
      playBlip("confirm");
      return;
    }

    const intent = matchIntent(transcript);

    if (!intent) {
      const question = transcript.trim();
      if (question.split(/\s+/).length < MIN_QUESTION_WORDS) return;

      // Starts like a command but matched nothing — say so plainly rather than
      // handing it to the model, which answers a failed command with confident
      // nonsense ("all music is off") and spends the user's trust.
      const COMMANDISH =
        /^(включ|выключ|выруб|останов|поставь|открой|закрой|убери|скрой|сделай|покажи|играй|громче|тише|louder|quieter|play|open|close|stop)(\s|$)/;
      if (COMMANDISH.test(lower)) {
        playBlip("confirm");
        speak(lang === "ru" ? "Не понял команду" : "Did not catch that command", lang);
        setLastCommand("?");
        if (clearTimer.current) clearTimeout(clearTimer.current);
        clearTimer.current = setTimeout(() => setLastCommand(null), COMMAND_DISPLAY_MS);
        return;
      }

      // Do not stack a question on one still being answered or spoken.
      //
      // There was a second guard here that dropped a question whose words
      // mostly appeared in the previous answer, meant to catch echo. It caught
      // follow-ups instead: ask about the exchange rate, then ask again, and
      // every word of the second question was in the first answer, so it was
      // discarded in silence. Echo is already handled where it happens — the
      // recogniser ignores what it hears while the assistant speaks.
      const chatStatus = useChatStore.getState().status;
      if (chatStatus === "thinking" || chatStatus === "streaming" || isSystemSpeaking()) {
        return;
      }

      // Otherwise it is a question for the assistant.
      const openModuleId = useOrbitStore.getState().expandedId;
      const openModule = openModuleId ? findModule(openModuleId) : undefined;
      playBlip("confirm");
      setLastCommand(lang === "ru" ? "вопрос" : "question");
      void askAssistant(question, openModule?.label ?? null, lang);
      return;
    }

    const store = useOrbitStore.getState();

    // Anything that has something to show needs the screen back: the face
    // covers everything, so opening a module behind it would be invisible.
    if (intent.kind === "open" || intent.kind === "search" || intent.kind === "rotate") {
      hideVita();
    }

    switch (intent.kind) {
      case "open": {
        store.dispatch({ type: "expand", cardId: intent.moduleId, source: "voice" });
        const opened = findModule(intent.moduleId);
        if (opened) void briefingFor(opened, lang).then((advice) => speak(advice.spoken, lang));
        break;
      }
      case "rotate":
        store.dispatch({ type: "rotate", direction: intent.direction, source: "voice" });
        break;
      case "close":
        store.dispatch({ type: "collapse", source: "voice" });
        clearSearch();
        break;
      case "showFace":
        if (intent.show) showVita();
        else hideVita();
        break;
      case "wake":
        // Just answer. Nothing else to do.
        break;
      case "pause":
        if (!commandPlayer("pause")) {
          speak(lang === "ru" ? "Сейчас ничего не играет" : "Nothing is playing", lang);
        }
        break;
      case "resume":
        if (!commandPlayer("resume")) {
          speak(lang === "ru" ? "Нечего продолжать" : "Nothing to resume", lang);
        }
        break;
      case "next": {
        const track = nextFavorite();
        if (track) {
          playSavedTrack(track);
          speak(lang === "ru" ? `Дальше: ${track.title}` : `Next: ${track.title}`, lang);
        } else {
          speak(
            lang === "ru"
              ? "В избранном нет следующего трека"
              : "No next track in favourites",
            lang,
          );
        }
        break;
      }
      case "volume": {
        let level = nudgeVolume(intent.direction);
        // A confirmation at zero cannot be heard, so the floor is one notch up.
        if (level <= 0.001) level = nudgeVolume("up");
        // The reply already queued would otherwise play at the old level and
        // the change would only take effect on the sentence after it.
        applyVolumeNow(level);
        commandPlayer(usePlayStore.getState().paused ? "pause" : "resume");
        setLastCommand(`${lang === "ru" ? "громкость" : "volume"} ${Math.round(level * 100)}%`);
        break;
      }
      case "dismiss":
        if (intent.target === "chat" || intent.target === "all") clearChat();
        if (intent.target === "player" || intent.target === "all") clearPlayback();
        if (intent.target === "all") {
          clearSearch();
          store.dispatch({ type: "collapse", source: "voice" });
          hideVita();
        }
        break;
      case "favoriteAdd": {
        const now = usePlayStore.getState();
        if (now.videoId && now.title) {
          const count = addFavorite({
            videoId: now.videoId,
            title: now.title,
            url: now.url ?? "",
          });
          speak(
            count === null
              ? lang === "ru"
                ? "Этот трек уже в избранном"
                : "That track is already saved"
              : lang === "ru"
                ? `Запомнил. В избранном треков: ${count}`
                : `Saved. ${count} in favorites`,
            lang,
          );
        } else {
          speak(
            lang === "ru"
              ? "Сейчас ничего не играет — нечего запоминать"
              : "Nothing is playing to save",
            lang,
          );
        }
        break;
      }
      case "favoritePlay": {
        const track = nextFavorite();
        if (!track) {
          speak(
            lang === "ru"
              ? "В избранном пусто. Скажите «запомни трек», когда что-то играет"
              : "No favorites yet. Say “save track” while something is playing",
            lang,
          );
        } else {
          playSavedTrack(track);
          speak(
            lang === "ru"
              ? `Включаю избранное: ${track.title}`
              : `Playing from favorites: ${track.title}`,
            lang,
          );
        }
        break;
      }
      case "play":
        void playTrack(intent.query).then((status) => {
          const said =
            status === "ready"
              ? lang === "ru"
                ? // It may already be playing (autoplay), or waiting for the
                  // one click a browser insists on before a page makes sound.
                  `Включаю. Если тихо — нажмите play на плеере слева`
                : `Playing. If it is silent, press play on the panel`
              : status === "notFound"
                ? lang === "ru"
                  ? "Не нашёл, что включить"
                  : "Could not find anything to play"
                : lang === "ru"
                  ? "Не смог включить"
                  : "Could not play that";
          speak(said, lang);
        });
        break;
      case "search":
        void runSearch(intent.query).then((results) => {
          // Spoken after the fact, because the answer is the point of a search
          // — announcing only that one started leaves the user waiting blind.
          if (!results.length) {
            speak(lang === "ru" ? "Ничего не нашёл" : "Nothing found", lang);
            return;
          }
          const count = results.length;
          const first = results[0].title;
          speak(
            lang === "ru"
              ? `Нашёл ${count}. Первый: ${first}`
              : `Found ${count}. First: ${first}`,
            lang,
          );
        });
        break;
    }

    playBlip("confirm");
    // Opening a module and searching each produce their own spoken answer once
    // the data lands. Saying "Opening Instagram" first only gets cut off by it,
    // and "opening" was never the useful half of the reply anyway.
    if (
      intent.kind !== "open" &&
      intent.kind !== "search" &&
      intent.kind !== "play" &&
      intent.kind !== "favoriteAdd" &&
      intent.kind !== "favoritePlay" &&
      intent.kind !== "dismiss" &&
      intent.kind !== "pause" &&
      intent.kind !== "resume" &&
      intent.kind !== "next"
    ) {
      speak(replyFor(intent, lang), lang);
    }
    setLastCommand(intent.label);
    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => setLastCommand(null), COMMAND_DISPLAY_MS);
  }, []);

  /**
   * "стоп" — cut the voice and the answer that is still streaming, and say
   * nothing back. The point of the word is silence; a spoken "ок" defeats it.
   */
  const handleStop = useCallback((lang: SpeechLang) => {
    stopSpeaking();
    clearChat();
    clearSearch();
    // Paused rather than closed: "стоп" then "продолжи" should carry on from
    // where it was, and closing the panel loses the track entirely.
    commandPlayer("pause");
    playBlip("confirm");
    setTranscript("");
    setLastCommand(lang === "ru" ? "стоп" : "stop");
    // The sentence that was cut keeps arriving through the mic for a moment;
    // stay deaf so its tail is not taken as a new question.
    deafUntil.current = Date.now() + AFTER_STOP_DEAF_MS;
    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => setLastCommand(null), COMMAND_DISPLAY_MS);
  }, []);

  const enable = useCallback(() => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      setVoiceError("This browser has no speech recognition. Chrome supports it.");
      return;
    }
    if (recognitionRef.current) return;

    setVoiceStatus("starting");
    wantsRunning.current = true;

    primeVoices();
    const recognition = new Recognition();
    // Russian first: the founder tests in Russian, and the command engine
    // understands both languages regardless of which the recogniser uses.
    const lang: SpeechLang = navigator.language?.startsWith("ru") ? "ru" : "en";
    recognition.lang = lang === "ru" ? "ru-RU" : "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setVoiceStatus("listening");

    recognition.onresult = (event) => {
      // Just cut the voice — the tail of that sentence is still coming back
      // through the microphone. Ignore everything until it has passed.
      if (Date.now() < deafUntil.current) return;

      // Somebody is talking. Step the music back so the rest of the sentence
      // reaches the microphone over it — commands were being lost to the
      // speakers, which is why nothing responded while a track played.
      duckMusic(true);
      if (unduckTimer.current) clearTimeout(unduckTimer.current);
      unduckTimer.current = setTimeout(() => {
        if (!isSystemSpeaking()) duckMusic(false);
      }, 2500);

      const speakingNow = isSystemSpeaking();

      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = (result[0]?.transcript ?? "").trim();

        // "стоп" is honoured immediately, even from a partial result, so a long
        // answer stops the moment the word is heard rather than after it.
        if (isStopCommand(text)) {
          handleStop(lang);
          return;
        }

        if (!result.isFinal) {
          if (!speakingNow) interim += text;
          continue;
        }

        const intent = matchIntent(text);

        if (speakingNow) {
          // A command said over the top is obeyed immediately — waiting for a
          // long reply to finish is what made the system feel dead. A question
          // is not: answering mid-answer is the loop that made it ramble.
          if (!intent) continue;
          // Even a command can be the assistant quoting itself.
          if (isOwnEcho(text)) continue;
          stopSpeaking();
        } else if (!intent) {
          // A question, with the voice just stopped. The tail of what was said
          // is still arriving; nothing said this soon is treated as a question.
          const since = msSinceSpeechEnded();
          if (since < QUIET_AFTER_SPEECH_MS) continue;
          if (since < ECHO_WINDOW_MS && isOwnEcho(text)) continue;
        }

        setTranscript(text);
        runIntent(text, lang);
      }
      if (interim) setTranscript(interim.trim());
    };

    recognition.onerror = (event) => {
      // "no-speech" fires constantly during silence and is not a failure.
      if (event.error === "no-speech") return;
      wantsRunning.current = false;
      recognitionRef.current = null;
      setVoiceError(describeError(event.error));
    };

    // Chrome ends continuous sessions on its own every so often; restart unless
    // the user actually asked to stop, or listening silently dies after a while.
    recognition.onend = () => {
      if (!wantsRunning.current) {
        recognitionRef.current = null;
        setVoiceStatus("off");
        return;
      }
      try {
        recognition.start();
      } catch {
        recognitionRef.current = null;
        setVoiceStatus("off");
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setVoiceError("Could not start listening.");
    }
  }, [runIntent, handleStop]);

  const disable = useCallback(() => {
    wantsRunning.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    stopSpeaking();
    clearChat();
    setVoiceStatus("off");
    setTranscript("");
    setLastCommand(null);
  }, []);

  useEffect(
    () => () => {
      wantsRunning.current = false;
      recognitionRef.current?.abort();
      stopSpeaking();
      if (clearTimer.current) clearTimeout(clearTimer.current);
    },
    [],
  );

  return { status, enable, disable };
}
