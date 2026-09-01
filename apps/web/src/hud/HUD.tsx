"use client";

import { useEffect, useState } from "react";
import { useOrbitStore } from "@/stores/orbitStore";
import { useGestureStore } from "@/stores/gestureStore";
import { useQualityStore } from "@/quality/qualityStore";
import { useAudioStore, toggleAudio } from "@/audio/audioStore";
import { useInteractionSounds } from "@/audio/useInteractionSounds";
import { useVoiceCommands } from "@/voice/useVoiceCommands";
import { useVoiceStore } from "@/voice/voiceStore";
import { useChatStore } from "@/voice/chatStore";
import { useVitaStore, hideVita } from "@/stores/vitaStore";
import { ASSISTANT_NAME } from "@/config/assistant";
import { useCardStyleStore, cycleCardStyle, CARD_STYLE_LABEL } from "@/stores/cardStyleStore";
import { warmUpServerVoice } from "@/voice/speech";
import { useHandTrackingAdapter } from "@/gestures/adapters/useHandTrackingAdapter";
import { getPreferredDelegate, setPreferredDelegate, type Delegate } from "@/gestures/engine/handTracking";
import { describeHandRate, type HandRateReadout } from "@/gestures/handRateReadout";
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

const RATE_TONE: Record<HandRateReadout["tone"], string> = {
  good: "text-signal",
  warn: "text-warn",
  quiet: "text-mist",
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
  const rateSample = useGestureStore((s) => s.handRate);
  const [delegate, setDelegate] = useState<Delegate>(() => getPreferredDelegate());
  const handRate = describeHandRate(status, rateSample);
  const errorMessage = useGestureStore((s) => s.errorMessage);
  const fps = useQualityStore((s) => s.fps);
  const tier = useQualityStore((s) => s.tier);
  const audioOn = useAudioStore((s) => s.enabled);
  const { status: voiceStatus, enable: enableVoice, disable: disableVoice, stop: stopVoice } = useVoiceCommands();
  const transcript = useVoiceStore((s) => s.transcript);
  const lastCommand = useVoiceStore((s) => s.lastCommand);
  const voiceError = useVoiceStore((s) => s.errorMessage);
  const heardWhileSpeaking = useVoiceStore((s) => s.heardWhileSpeaking);
  const chatStatus = useChatStore((s) => s.status);
  const answering = chatStatus === "thinking" || chatStatus === "streaming";
  const vitaVisible = useVitaStore((s) => s.visible);
  const cardStyle = useCardStyleStore((s) => s.style);
  useInteractionSounds();

  /**
   * Moves detection between the graphics card and the processor, and restarts
   * tracking so the choice actually takes: the loaded model is cached, and a
   * switch that left it in place would change the label and nothing else.
   *
   * Worth a control rather than a constant because "GPU" is not always the
   * faster of the two. A second WebGL context beside the scene's can cost more
   * per detection than the processor does, and which machine is which cannot
   * be known from here — only measured, in the line above this one.
   */
  const swapDelegate = async () => {
    const next: Delegate = delegate === "GPU" ? "CPU" : "GPU";
    disable();
    setPreferredDelegate(next);
    setDelegate(next);
    await enable();
  };

  // Load the server's voice model while the user is still looking at the
  // scene, so the first spoken reply is not the one that waits for it.
  useEffect(() => {
    warmUpServerVoice();
  }, []);

  // While the face is up the screen is just the face on black — the whole
  // dashboard is gone, leaving only the one hint for getting back.
  //
  // The camera element is outside that choice, in a fixed position in the tree.
  // It hosts the video the tracking engine holds, and a video React unmounts is
  // one the browser stops decoding: the engine keeps its reference, sees no
  // more frames, and hand tracking is dead for the rest of the session with the
  // button still reading ON. Showing the face and hiding it again was enough.
  //
  // Rendering it in both branches is not enough either — a different parent
  // means a different element, and the engine would still hold the old one. It
  // has to be the same node either way, which is why the branch is inside the
  // fragment rather than around it.
  return (
    <>
      <CameraFeed videoRef={videoRef} />
      {vitaVisible ? (
        <div className="fixed inset-x-0 bottom-8 z-20 flex justify-center font-mono">
          <button
            type="button"
            onClick={hideVita}
            className="pointer-events-auto flex items-center gap-2 rounded-full border border-signal/40 bg-[rgba(16,24,38,0.7)] px-4 py-1.5 backdrop-blur-md transition-colors hover:border-signal"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal shadow-[0_0_8px_rgba(111,179,255,0.7)]" />
            <span className="text-[11px] uppercase tracking-[0.2em] text-frost">{ASSISTANT_NAME}</span>
            <span className="text-[10px] text-mist/60">say “скрой лицо”</span>
          </button>
        </div>
      ) : (
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
        {/* It sat in the far corner at ten grey pixels, and he was asked for it
            twice without ever finding it. It belongs under the button that
            turns tracking on, at a size that can be read out loud from where he
            sits, because below about fifteen readings a second a gesture feels
            dead however good the code is — and which of those two problems this
            machine has cannot be told from the outside. */}
        {handRate && (
          <div className="mt-1 max-w-[320px]">
            <div className={`text-lg tabular-nums tracking-wide ${RATE_TONE[handRate.tone]}`}>{handRate.text}</div>
            {/* Ten readings a second because the camera sends ten, and ten
                because the machine cannot look faster, are the same number
                with opposite cures. This line says which — and it is printed
                at a size that can be read out loud, because the first attempt
                put it in ten grey pixels in a corner and it went unread
                twice, which is the very mistake the rate itself was moved for. */}
            {handRate.detail && (
              <div className="text-sm tabular-nums tracking-wide text-frost/80">{handRate.detail}</div>
            )}
          </div>
        )}
        {status === "active" && (
          <button
            type="button"
            onClick={() => void swapDelegate()}
            className="block text-[11px] text-mist mt-1 hover:text-frost transition-colors cursor-pointer"
          >
            LOOKING WITH &mdash; <span className="text-frost">{delegate}</span>
            <span className="text-mist/60"> (click to try {delegate === "GPU" ? "CPU" : "GPU"})</span>
          </button>
        )}
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
        <button
          type="button"
          onClick={cycleCardStyle}
          className="block text-[11px] text-mist mt-1 hover:text-frost transition-colors cursor-pointer"
        >
          CARDS &mdash; <span className="text-signal">{CARD_STYLE_LABEL[cardStyle]}</span>
          <span className="text-mist/60"> (click to change)</span>
        </button>
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
      {/* A stop that does not go through the microphone.
          He says "стоп" over a long answer and is read to anyway. Until it is
          known whether the word even reaches the recogniser over the speakers,
          there has to be a way out that cannot fail — and one visible on a
          recording, so nobody has to take it on trust. */}
      {answering && (
        <div className="col-span-2 row-start-2 self-start justify-self-center mt-2">
          <button
            type="button"
            onClick={stopVoice}
            className="pointer-events-auto flex items-center gap-2 rounded-full border border-warn/50 bg-[rgba(16,24,38,0.75)] px-5 py-2 backdrop-blur-md transition-colors hover:border-warn"
          >
            <span className="h-2 w-2 rounded-full bg-warn shadow-[0_0_10px_rgba(255,170,80,0.8)]" />
            <span className="text-[13px] uppercase tracking-[0.2em] text-frost">СТОП</span>
            <span className="text-[11px] text-mist/70">Esc</span>
          </button>
          {/* What the microphone actually caught over its own voice. If his
              "стоп" is not here, the word never arrived — a different fault
              with a different cure than one that arrived and was ignored. */}
          {heardWhileSpeaking.length > 0 && (
            <div className="mt-2 max-w-sm text-center text-[11px] text-mist">
              <div className="uppercase tracking-widest text-[10px] text-mist/60">слышно поверх речи</div>
              {heardWhileSpeaking.map((line, index) => (
                <div key={`${index}-${line}`} className="truncate text-frost/80">
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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

    </div>
      )}
    </>
  );
}
