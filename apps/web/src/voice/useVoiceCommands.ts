"use client";

import { useCallback, useEffect, useRef } from "react";
import { useOrbitStore } from "@/stores/orbitStore";
import { playBlip } from "@/audio/audioStore";
import { getSpeechRecognition, type SpeechRecognitionLike } from "./speechTypes";
import { matchIntent, replyFor } from "./commandEngine";
import { speak, stopSpeaking, primeVoices, isSystemSpeaking, type SpeechLang } from "./speech";
import {
  useVoiceStore,
  setVoiceStatus,
  setTranscript,
  setLastCommand,
  setVoiceError,
} from "./voiceStore";

/** How long a recognised command stays on screen before the readout clears. */
const COMMAND_DISPLAY_MS = 2500;

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

  const runIntent = useCallback((transcript: string, lang: SpeechLang) => {
    const intent = matchIntent(transcript);
    if (!intent) return;

    const store = useOrbitStore.getState();
    switch (intent.kind) {
      case "open":
        store.dispatch({ type: "expand", cardId: intent.moduleId, source: "voice" });
        break;
      case "rotate":
        store.dispatch({ type: "rotate", direction: intent.direction, source: "voice" });
        break;
      case "close":
        store.dispatch({ type: "collapse", source: "voice" });
        break;
    }

    playBlip("confirm");
    speak(replyFor(intent, lang), lang);
    setLastCommand(intent.label);
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
      // Everything heard while the system is talking is its own reply coming
      // back through the microphone, so it is dropped rather than obeyed.
      if (isSystemSpeaking()) return;

      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) {
          setTranscript(text.trim());
          runIntent(text, lang);
        } else {
          interim += text;
        }
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
  }, [runIntent]);

  const disable = useCallback(() => {
    wantsRunning.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    stopSpeaking();
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
