"use client";

import { useCallback, useEffect, useRef } from "react";
import { useOrbitStore } from "@/stores/orbitStore";
import { ensureAudio, playBlip } from "@/audio/audioStore";
import { getSpeechRecognition, type SpeechRecognitionLike } from "./speechTypes";
import { matchIntent, replyFor } from "./commandEngine";
import { isEchoOfSpeech, isTailOfSpeech } from "./echo";
import { looksLikeFailedCommand } from "./failedCommand";
import { afterStop, isStopCommand, withoutStopWords } from "./stopWords";
import { recoveryFor } from "./recognitionRecovery";

/** The language the recogniser runs in, without waiting for it to start. */
function currentLang(): SpeechLang {
  return typeof navigator !== "undefined" && navigator.language?.startsWith("ru") ? "ru" : "en";
}
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
import { saveTrack, nextFrom, listPlaylists } from "./playlistStore";
import { showVita, hideVita } from "@/stores/vitaStore";
import { nudgeVolume } from "@/audio/volumeStore";
import { briefingFor, findModule } from "@/modules/briefing";
import { askAssistant, clearChat, stopAnswer, useChatStore } from "./chatStore";

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
  /** The collection last played from, so "дальше" stays inside it. */
  const lastPlaylist = useRef<string | null>(null);
  /** When "стоп" was last acted on, so its final transcript is not answered twice. */
  const lastStopAt = useRef(0);

  /**
   * Says on screen why something heard was not acted on.
   *
   * Every discarded phrase used to vanish without trace, and "it does not
   * answer" was all anyone could report. A reason he can read back turns that
   * into something that can be fixed.
   */
  const showDropped = useCallback((reason: string) => {
    setLastCommand(reason);
    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => setLastCommand(null), COMMAND_DISPLAY_MS);
  }, []);
  /** Errors in a row with no result between them; reset the moment one lands. */
  const failures = useRef(0);
  /** Set while waiting out a backoff, so onend does not restart underneath it. */
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runIntent = useCallback((transcript: string, lang: SpeechLang) => {
    const lower = transcript.trim().toLowerCase();

    const intent = matchIntent(transcript);

    // Music is playing and the user said something that means stop, in words
    // the matcher does not cover. Kept so a phrasing it misses never reaches
    // the model, which will cheerfully report that the music stopped when it
    // did not.
    //
    // It runs after the matcher, not before. Ahead of it, this claimed any
    // short phrase containing a stop word: "убери лицо" turned the music off
    // and left the face exactly where it was. A recognised command now decides
    // for itself, and this only catches what nothing else did.
    if (!intent) {
      const STOPPY = /выключ|выруб|останов|заглуш|глуши|убери|хватит|отключ|стоп|turn off|shut|stop|pause/;
      const namesSomethingElse = /чат|ответ|лиц|окн|chat|answer|face|вс[её]|everything|\ball\b/.test(lower);
      const namesMusic = /музык|песн|трек|плеер|music|song|track|player|полност/.test(lower);
      const bareOrder = lower.split(/\s+/).filter(Boolean).length <= 2;

      if (
        usePlayStore.getState().status !== "idle" &&
        STOPPY.test(lower) &&
        !namesSomethingElse &&
        (namesMusic || bareOrder)
      ) {
        clearPlayback();
        speak(lang === "ru" ? "Выключаю музыку" : "Stopping the music", lang);
        setLastCommand(lang === "ru" ? "музыка выкл." : "music off");
        playBlip("confirm");
        return;
      }
    }

    if (!intent) {
      const question = transcript.trim();
      if (question.split(/\s+/).length < MIN_QUESTION_WORDS) return;

      // Starts like an order to the application, and matched nothing. Refused
      // rather than handed on — see failedCommand.ts for which verbs, and why
      // opening and showing are no longer among them.
      if (looksLikeFailedCommand(lower)) {
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
      // A new question while an answer is still coming used to be dropped in
      // silence, so asking again looked like being ignored. He has moved on:
      // the old answer stops and the new question is asked. Echo never gets
      // this far — it is filtered where the transcript arrives.
      const chatStatus = useChatStore.getState().status;
      if (chatStatus === "thinking" || chatStatus === "streaming" || isSystemSpeaking()) {
        stopSpeaking();
        stopAnswer();
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
        // Continues within whatever collection was last playing, so "дальше"
        // after "включи подборку для работы" stays in that collection.
        const picked = nextFrom(lastPlaylist.current);
        if (picked) {
          playSavedTrack(picked.track);
          speak(lang === "ru" ? `Дальше: ${picked.track.title}` : `Next: ${picked.track.title}`, lang);
        } else {
          speak(
            lang === "ru" ? "Дальше ничего не сохранено" : "Nothing saved to play next",
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
        if (!now.videoId || !now.title) {
          speak(
            lang === "ru"
              ? "Сейчас ничего не играет — нечего запоминать"
              : "Nothing is playing to save",
            lang,
          );
          break;
        }
        const outcome = saveTrack(
          { videoId: now.videoId, title: now.title, url: now.url ?? "" },
          intent.playlist,
        );
        const where = outcome.playlist.name;
        const total = outcome.playlist.tracks.length;
        speak(
          !outcome.added
            ? lang === "ru"
              ? `Этот трек уже в подборке «${where}»`
              : `Already in “${where}”`
            : outcome.created
              ? lang === "ru"
                ? `Создал подборку «${where}» и добавил трек`
                : `Created “${where}” and saved the track`
              : lang === "ru"
                ? `Добавил в «${where}». Всего треков: ${total}`
                : `Saved to “${where}”. ${total} in it now`,
          lang,
        );
        break;
      }
      case "favoritePlay": {
        const picked = nextFrom(intent.playlist);
        if (!picked) {
          const named = intent.playlist;
          speak(
            named
              ? lang === "ru"
                ? `Не нашёл подборку «${named}»`
                : `No collection called “${named}”`
              : lang === "ru"
                ? "Пока ничего не сохранено. Скажите «сохрани в подборку», когда что-то играет"
                : "Nothing saved yet. Say “save to a collection” while something plays",
            lang,
          );
          break;
        }
        lastPlaylist.current = picked.playlist.name;
        playSavedTrack(picked.track);
        speak(
          lang === "ru"
            ? `Включаю «${picked.playlist.name}»: ${picked.track.title}`
            : `Playing “${picked.playlist.name}”: ${picked.track.title}`,
          lang,
        );
        break;
      }
      case "playlistList": {
        const lists = listPlaylists().filter((p) => p.tracks.length);
        if (!lists.length) {
          speak(
            lang === "ru"
              ? "Подборок пока нет. Скажите «сохрани в подборку для работы», когда что-то играет"
              : "No collections yet. Say “save to a collection” while something plays",
            lang,
          );
          break;
        }
        const spoken = lists
          .map((p) => `${p.name} — ${p.tracks.length}`)
          .join(", ");
        speak(
          lang === "ru" ? `Ваши подборки: ${spoken}` : `Your collections: ${spoken}`,
          lang,
        );
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
      intent.kind !== "playlistList" &&
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
   * "стоп" — cut the voice and the answer that is still streaming.
   *
   * It used to say nothing back, on the reasoning that the point of the word
   * is silence. From across the room silence cannot be told from not having
   * been heard, so he said it again while it carried on, and asked for it
   * plainly: stop at once and say «Да, слушаю вас». A key press still stops in
   * silence; only the spoken word is answered.
   */
  const handleStop = useCallback((lang: SpeechLang, acknowledge = false) => {
    lastStopAt.current = Date.now();
    stopSpeaking();
    stopAnswer();
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
    // One of the everyday lines, synthesised in advance, so it is heard at
    // once rather than after a round trip to the voice.
    if (acknowledge) speak(lang === "ru" ? "Да, слушаю вас" : "Yes, I'm listening", lang);
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

    // This click is the gesture the browser needs before any sound. Spent on
    // the interface tones too, so a question is answered by a tone at once
    // rather than by a second or two of silence.
    void ensureAudio().catch(() => {});
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

      // Something was heard, so whatever went wrong before is over.
      failures.current = 0;

      const speakingNow = isSystemSpeaking();

      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = (result[0]?.transcript ?? "").trim();

        // "стоп" is honoured immediately, even from a partial result, so a long
        // answer stops the moment the word is heard rather than after it.
        if (isStopCommand(text)) {
          // A phrase can carry two orders. He said "стоп и закрой лицо" and the
          // voice stopped with the face still up: stopping returned here and
          // the rest of the sentence was never read. What to do with the rest
          // is decided in afterStop, where it is tested.
          const rest = withoutStopWords(text);
          const next = afterStop({
            rest,
            restIsCommand: Boolean(rest && matchIntent(rest)),
            restIsEcho: Boolean(rest) && (isTailOfSpeech(rest, recentSpokenText()) || isOwnEcho(rest)),
            isFinal: result.isFinal,
            msSinceLastStop: Date.now() - lastStopAt.current,
          });
          handleStop(lang, next === "acknowledge");
          if (next === "command" || next === "question") {
            setTranscript(rest);
            runIntent(rest, lang);
          }
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
          // is still arriving, so for a moment its own last words come back.
          // Everything in that moment used to be thrown away — and with it any
          // short question asked straight after an answer: "что ты умеешь"
          // fits inside the window whole and vanished. Now only the tail is
          // dropped, recognised by being the assistant's own words in its
          // own order; see echo.ts.
          const since = msSinceSpeechEnded();
          const echo =
            (since < QUIET_AFTER_SPEECH_MS && isTailOfSpeech(text, recentSpokenText())) ||
            (since < ECHO_WINDOW_MS && isOwnEcho(text));
          if (echo) {
            // Said on screen, so "it did not answer" can be told from "it
            // heard its own voice and rightly ignored it".
            showDropped(lang === "ru" ? "своё эхо, пропущено" : "own echo, ignored");
            continue;
          }
        }

        setTranscript(text);
        runIntent(text, lang);
      }
      if (interim) setTranscript(interim.trim());
    };

    recognition.onerror = (event) => {
      // Every code used to end here for good — including "aborted", which
      // Chrome raises as a matter of course and which cutting the voice
      // mid-sentence is enough to cause. The microphone went deaf a minute
      // after being switched on and stayed deaf, and the only sign of it was
      // a line of English in the corner.
      const decision = recoveryFor(event.error, failures.current, currentLang());
      if (decision.action === "give-up") {
        wantsRunning.current = false;
        recognitionRef.current = null;
        setVoiceError(decision.message);
        setVoiceStatus("error");
        return;
      }

      failures.current += 1;
      // onend follows an error, and restarts on its own when the wait is zero.
      if (decision.delayMs > 0) {
        if (retryTimer.current) clearTimeout(retryTimer.current);
        retryTimer.current = setTimeout(() => {
          retryTimer.current = null;
          if (!wantsRunning.current) return;
          try {
            recognition.start();
          } catch {
            // Already running, which is the outcome this wanted anyway.
          }
        }, decision.delayMs);
      }
    };

    // Chrome ends continuous sessions on its own every so often; restart unless
    // the user actually asked to stop, or listening silently dies after a while.
    recognition.onend = () => {
      if (!wantsRunning.current) {
        recognitionRef.current = null;
        setVoiceStatus("off");
        return;
      }
      // A backoff is already counting down; restarting now would defeat it.
      if (retryTimer.current) return;
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
  }, [runIntent, handleStop, showDropped]);

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

  /**
   * A way to stop that does not go through the microphone.
   *
   * He says "стоп" over a long answer and is read to anyway. Whatever the
   * cause turns out to be, an assistant talking over a person who wants it
   * quiet must have an escape that cannot fail — and one that does not depend
   * on the very channel that is currently full of its own voice.
   */
  const stop = useCallback(() => handleStop(currentLang()), [handleStop]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      stop();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [stop]);

  return { status, enable, disable, stop };
}
