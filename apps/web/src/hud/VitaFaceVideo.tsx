"use client";

import { useEffect, useRef } from "react";
import { useVitaStore } from "@/stores/vitaStore";
import { voiceLevel, setRobotVoice } from "@/audio/voiceLevel";

/**
 * Vita's face — the generated hologram, shown over a black screen.
 *
 * The clip assembles itself: a spark, a swirl of particles, then the figure.
 * It plays once from the start each time the face is summoned, then loops its
 * formed tail so it keeps breathing.
 *
 * The frame is near-black, so `screen` blending plus a contrast lift drop the
 * background and a radial mask feathers the edges — no rectangle, no border.
 * While the face is up the dashboard is fully hidden behind black, the voice
 * runs through the robot filter, and the figure lifts with the voice level.
 */

/** Seconds: where the assembly ends and the formed loop begins. */
const LOOP_START = 5.0;

/** Bump when the file at /vita-face.mp4 is replaced, so the browser re-fetches
 *  instead of serving a stale cached clip. */
const CLIP = "/vita-face.mp4?v=5";

export function VitaFaceVideo() {
  const visible = useVitaStore((s) => s.visible);
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const raf = useRef<number | null>(null);

  // The robot voice belongs to the face: on while it is shown, off with it.
  useEffect(() => {
    setRobotVoice(visible);
    return () => setRobotVoice(false);
  }, [visible]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (visible) {
      video.currentTime = 0;
      void video.play().catch(() => {});
      const tick = () => {
        wrapRef.current?.style.setProperty("--v", voiceLevel().toFixed(3));
        raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
      return () => {
        if (raf.current) cancelAnimationFrame(raf.current);
        raf.current = null;
      };
    }

    const stop = window.setTimeout(() => video.pause(), 700);
    return () => window.clearTimeout(stop);
  }, [visible]);

  return (
    <div
      ref={wrapRef}
      aria-hidden={!visible}
      className="fixed inset-0 z-[6] flex items-center justify-center"
      style={{
        ["--v" as string]: "0",
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
        transition: "opacity 700ms ease",
      }}
    >
      {/* Black screen: the dashboard is gone entirely while the face is up. */}
      <div className="absolute inset-0 bg-black" />

      <video
        ref={videoRef}
        src={CLIP}
        muted
        playsInline
        preload="auto"
        onEnded={() => {
          const v = videoRef.current;
          if (!v) return;
          v.currentTime = LOOP_START;
          void v.play().catch(() => {});
        }}
        className="absolute inset-0 h-full w-full object-cover"
        style={{
          // No blend mode and no drop-shadow: both are full-screen per-frame
          // GPU passes and this has to run while a video decodes. Contrast lifts
          // the near-black frame to true black, the mask feathers the edge.
          filter:
            "contrast(1.22) brightness(calc(0.98 + var(--v) * 0.35)) saturate(calc(1 + var(--v) * 0.4))",
          transform: "scale(calc(1 + var(--v) * 0.025))",
          transition: "filter 120ms linear, transform 120ms linear",
          WebkitMaskImage:
            "radial-gradient(ellipse 60% 70% at 50% 45%, #000 42%, transparent 90%)",
          maskImage: "radial-gradient(ellipse 60% 70% at 50% 45%, #000 42%, transparent 90%)",
        }}
      />
    </div>
  );
}
