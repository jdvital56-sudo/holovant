"use client";

import { create } from "zustand";

/**
 * One volume level for everything the app makes audible — the assistant's
 * voice and the music player. "Сделай громче / тише" moves this; the pieces
 * that play sound read it.
 */
interface VolumeState {
  /** 0..1. */
  level: number;
}

const KEY = "holovant.volume.v1";
const STEP = 0.15;

function load(): number {
  if (typeof window === "undefined") return 0.9;
  try {
    const raw = window.localStorage.getItem(KEY);
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.9;
  } catch {
    return 0.9;
  }
}

export const useVolumeStore = create<VolumeState>(() => ({ level: load() }));

export function getVolume(): number {
  return useVolumeStore.getState().level;
}

function persist(level: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, String(level));
  } catch {
    // Not worth failing a volume change over storage being blocked.
  }
}

/** Returns the new level so the caller can confirm it out loud. */
export function nudgeVolume(direction: "up" | "down"): number {
  const current = useVolumeStore.getState().level;
  const next = Math.min(1, Math.max(0, current + (direction === "up" ? STEP : -STEP)));
  useVolumeStore.setState({ level: next });
  persist(next);
  return next;
}

export function setVolume(level: number) {
  const clamped = Math.min(1, Math.max(0, level));
  useVolumeStore.setState({ level: clamped });
  persist(clamped);
}
