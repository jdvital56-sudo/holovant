"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { qualityPresets, TIER_ORDER } from "./qualityPresets";
import { useQualityStore, setMeasuredFps, setTier } from "./qualityStore";

/** Sustained frame rate below this means the current tier is too expensive. */
const DOWNGRADE_FPS = 50;
/** Headroom must be this good before spending it again. */
const UPGRADE_FPS = 58;
/** Slow to give up quality, slower still to reclaim it — prevents oscillation. */
const DOWNGRADE_AFTER_MS = 2000;
const UPGRADE_AFTER_MS = 6000;
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
