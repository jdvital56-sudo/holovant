"use client";

import { useEffect, useState } from "react";
import { useOrbitStore } from "@/stores/orbitStore";
import { useGestureStore } from "@/stores/gestureStore";
import { useQualityStore } from "@/quality/qualityStore";
import { useAudioStore, toggleAudio } from "@/audio/audioStore";
import { useInteractionSounds } from "@/audio/useInteractionSounds";
import { useVoiceCommands } from "@/voice/useVoiceCommands";
import { useVoiceStore } from "@/voice/voiceStore";
import { useHandTrackingAdapter } from "@/gestures/adapters/useHandTrackingAdapter";
import { CameraFeed } from "./CameraFeed";
import { moduleRegistry } from "@/modules/registry";

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const kickoff = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(kickoff);
      clearInterval(id);
    };
  }, []);
  return now;
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

const STATUS_LABEL: Record<string, string> = {
  off: "OFF",
  starting: "STARTING…",
  active: "ON",
  error: "ERROR",
};

const VOICE_LABEL: Record<string, string> = {
  off: "OFF",
  starting: "STARTING…",
  listening: "LISTENING",
  error: "ERROR",
};

export function HUD() {
  const now = useClock();
  const selectedId = useOrbitStore((s) => s.selectedId);
  const selectedModule = moduleRegistry.find((m) => m.id === selectedId);
  const { status, enable, disable, videoRef } = useHandTrackingAdapter();
  const currentGesture = useGestureStore((s) => s.currentGesture);
  const confidence = useGestureStore((s) => s.confidence);
  const errorMessage = useGestureStore((s) => s.errorMessage);
  const fps = useQualityStore((s) => s.fps);
  const tier = useQualityStore((s) => s.tier);
  const audioOn = useAudioStore((s) => s.enabled);
  const { status: voiceStatus, enable: enableVoice, disable: disableVoice } = useVoiceCommands();
  const transcript = useVoiceStore((s) => s.transcript);
  const lastCommand = useVoiceStore((s) => s.lastCommand);
  const voiceError = useVoiceStore((s) => s.errorMessage);
  useInteractionSounds();

  return (
    // translate="no" keeps browser translators from replacing these text
    // nodes: the clock and frame counter rewrite themselves several times a
    // second, and React can hard-crash removing a node a translator swapped.
    <div
      translate="no"
      className="fixed inset-0 z-10 pointer-events-none p-4 sm:p-8 grid grid-cols-2 grid-rows-[auto_1fr_auto] font-mono"
    >
      <div className="pointer-events-auto col-start-1 row-start-1 justify-self-start">
        <div className="flex items-center gap-2 text-xs text-frost">
          <span className="w-1.5 h-1.5 rounded-full bg-signal shadow-[0_0_8px_rgba(111,179,255,0.6)] animate-pulse" />
          SYSTEM ONLINE
        </div>
        <div className="text-[11px] text-mist mt-1">
          <span className={fps > 0 && fps < 45 ? "text-warn" : "text-frost"}>{fps > 0 ? fps : "--"}</span> FPS
          &nbsp;&middot;&nbsp; QUALITY <span className="text-frost uppercase">{tier}</span>
        </div>
        <button
          type="button"
          onClick={status === "off" || status === "error" ? enable : disable}
          className="text-[11px] text-mist mt-1 hover:text-frost transition-colors cursor-pointer"
        >
          TRACKING &mdash;{" "}
          <span className={status === "active" ? "text-signal" : "text-frost"}>{STATUS_LABEL[status]}</span>
          <span className="text-mist/60"> (click to {status === "off" || status === "error" ? "enable" : "disable"})</span>
        </button>
        {errorMessage && <div className="text-[10px] text-warn mt-1 max-w-[220px]">{errorMessage}</div>}
        <button
          type="button"
          onClick={() => void toggleAudio()}
          className="block text-[11px] text-mist mt-1 hover:text-frost transition-colors cursor-pointer"
        >
          AUDIO &mdash; <span className={audioOn ? "text-signal" : "text-frost"}>{audioOn ? "ON" : "OFF"}</span>
          <span className="text-mist/60"> (click to {audioOn ? "disable" : "enable"})</span>
        </button>
        <button
          type="button"
          onClick={voiceStatus === "off" || voiceStatus === "error" ? enableVoice : disableVoice}
          className="block text-[11px] text-mist mt-1 hover:text-frost transition-colors cursor-pointer"
        >
          VOICE &mdash;{" "}
          <span className={voiceStatus === "listening" ? "text-signal" : "text-frost"}>
            {VOICE_LABEL[voiceStatus]}
          </span>
          <span className="text-mist/60">
            {" "}
            (click to {voiceStatus === "off" || voiceStatus === "error" ? "enable" : "disable"})
          </span>
        </button>
        {voiceError && <div className="text-[10px] text-warn mt-1 max-w-[220px]">{voiceError}</div>}
      </div>

      <div className="pointer-events-auto col-start-2 row-start-1 justify-self-end text-right">
        <div className="text-2xl sm:text-3xl text-frost tabular-nums">
          {now ? `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}` : "--:--:--"}
        </div>
        <div className="text-[11px] text-mist mt-1.5 tracking-wider">
          {now ? `${pad(now.getDate())} ${MONTHS[now.getMonth()]} ${now.getFullYear()}` : ""}
        </div>
      </div>

      <div className="pointer-events-auto col-start-1 row-start-3 self-end justify-self-start max-w-xs">
        <div className="text-[10px] tracking-widest uppercase text-mist mb-2">System log</div>
        <div className="text-[11px] text-mist leading-relaxed space-y-0.5">
          <div>&gt; holovant.core initialized</div>
          <div>&gt; module registry &mdash; {moduleRegistry.length} loaded</div>
          {selectedModule ? (
            <div className="text-frost">&gt; module: {selectedModule.id} selected</div>
          ) : (
            <div>&gt; awaiting selection</div>
          )}
        </div>
      </div>

      <div className="pointer-events-auto col-start-2 row-start-3 self-end justify-self-end text-right">
        <div className="text-[10px] tracking-widest uppercase text-mist mb-2">Gesture</div>
        <div className="text-[13px] text-frost">&mdash; {currentGesture ?? "idle"}</div>
        <div className="w-[140px] h-[3px] bg-white/10 my-2 rounded-full overflow-hidden ml-auto">
          <div className="h-full bg-signal-dim transition-[width] duration-150" style={{ width: `${Math.round(confidence * 100)}%` }} />
        </div>
        <div className="text-[10px] text-mist tracking-wide">
          {status === "active" ? "HAND TRACKING ACTIVE" : "MOUSE FALLBACK ACTIVE"}
        </div>
      </div>

      {/* Centred: what was heard is feedback about the user's own speech, so it
          belongs in the middle of their attention, not filed in a corner. */}
      {voiceStatus === "listening" && (
        <div className="col-span-2 row-start-3 self-end justify-self-center mb-14 w-full max-w-lg text-center">
          {lastCommand && (
            <div className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-signal drop-shadow-[0_0_12px_rgba(111,179,255,0.5)]">
              ✓ {lastCommand}
            </div>
          )}
          <div className="flex items-center justify-center gap-2 rounded-full border border-signal/25 bg-[rgba(16,24,38,0.6)] px-4 py-2 backdrop-blur-md">
            <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-signal" />
            <span className="truncate text-[13px] text-frost">
              {transcript || <span className="text-mist">listening — say “open Instagram”</span>}
            </span>
          </div>
        </div>
      )}

      <CameraFeed videoRef={videoRef} />
    </div>
  );
}
