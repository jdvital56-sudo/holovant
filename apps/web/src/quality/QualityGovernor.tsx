"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { qualityPresets, TIER_ORDER } from "./qualityPresets";
import { useQualityStore, setMeasuredFps, setTier } from "./qualityStore";

/** Sustained frame rate below this means the current tier is too expensive. */
const DOWNGRADE_FPS = 45;
/**
 * Deliberately under 60: a display refreshing at 60Hz almost never averages
 * above it, so a threshold nearer 60 is one quality can fall through but never
 * climb back — the scene ends up stuck at minimal on hardware that was coping.
 */
const UPGRADE_FPS = 54;
/** Slow to give up quality, slower still to reclaim it — prevents oscillation. */
const DOWNGRADE_AFTER_MS = 2500;
const UPGRADE_AFTER_MS = 5000;
/**
 * Nothing is judged during startup. Compiling shaders, warming caches and the
 * dev server's first compile all stall early frames, and reacting to that
 * drops quality before the scene has had a chance to run.
 */
const WARMUP_MS = 4000;
/** Reporting cadence; measurement itself happens every frame. */
const REPORT_INTERVAL_MS = 400;
/** Smoothing factor for the running average (higher = more reactive). */
const EMA_ALPHA = 0.1;

/**
 * Measures real frame time and steps quality down when the scene cannot hold
 * frame rate — then back up once it can. Mounted once inside the Canvas.
 */
export function QualityGovernor() {
  const setDpr = useThree((s) => s.setDpr);
  const tier = useQualityStore((s) => s.tier);

  const emaFps = useRef(60);
  const badSince = useRef<number | null>(null);
  const goodSince = useRef<number | null>(null);
  const lastReport = useRef(0);
  const startedAt = useRef(0);

  useEffect(() => {
    setDpr(Math.min(window.devicePixelRatio, qualityPresets[tier].pixelRatioCap));
  }, [tier, setDpr]);

  useFrame((_, delta) => {
    if (delta <= 0) return;
    const instantaneous = 1 / delta;
    emaFps.current += (instantaneous - emaFps.current) * EMA_ALPHA;
    const fps = emaFps.current;
    const now = performance.now();

    if (now - lastReport.current > REPORT_INTERVAL_MS) {
      lastReport.current = now;
      setMeasuredFps(Math.round(fps));
    }

    startedAt.current ||= now;
    if (now - startedAt.current < WARMUP_MS) return;

    const index = TIER_ORDER.indexOf(tier);

    if (fps < DOWNGRADE_FPS && index < TIER_ORDER.length - 1) {
      goodSince.current = null;
      badSince.current ??= now;
      if (now - badSince.current > DOWNGRADE_AFTER_MS) {
        badSince.current = null;
        setTier(TIER_ORDER[index + 1]);
      }
      return;
    }

    if (fps > UPGRADE_FPS && index > 0) {
      badSince.current = null;
      goodSince.current ??= now;
      if (now - goodSince.current > UPGRADE_AFTER_MS) {
        goodSince.current = null;
        setTier(TIER_ORDER[index - 1]);
      }
      return;
    }

    badSince.current = null;
    goodSince.current = null;
  });

  return null;
}
