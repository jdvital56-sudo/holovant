"use client";

import { create } from "zustand";

/**
 * The user's own saved tracks, kept so "включи избранное" plays their
 * collection without a search or a trip through the video player each time.
 * Held in localStorage: it is a personal list on this machine, not something
 * that belongs on a server or shared between people.
 */
export interface FavoriteTrack {
  videoId: string;
  title: string;
  url: string;
  savedAt: number;
}

interface FavoritesState {
  tracks: FavoriteTrack[];
  /** Rotates through the collection, so "включи избранное" twice in a row
   *  plays two different tracks rather than the same one. */
  cursor: number;
}

const KEY = "holovant.favorites.v1";

function load(): FavoriteTrack[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t): t is FavoriteTrack =>
        !!t &&
        typeof t === "object" &&
        typeof (t as FavoriteTrack).videoId === "string" &&
        typeof (t as FavoriteTrack).title === "string",
    );
  } catch {
    return [];
  }
}

function persist(tracks: FavoriteTrack[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(tracks));
  } catch {
    // Storage blocked or full; the collection just will not survive a reload.
  }
}

export const useFavoritesStore = create<FavoritesState>(() => ({
  tracks: load(),
  cursor: 0,
}));

/**
 * Adds a track unless it is already saved. Returns the new count, or null when
 * it was already there — the caller says different things for each.
 */
export function addFavorite(track: Omit<FavoriteTrack, "savedAt">): number | null {
  const { tracks } = useFavoritesStore.getState();
  if (tracks.some((t) => t.videoId === track.videoId)) return null;
  const next = [...tracks, { ...track, savedAt: Date.now() }];
  useFavoritesStore.setState({ tracks: next });
  persist(next);
  return next.length;
}

export function removeFavorite(videoId: string): void {
  const next = useFavoritesStore.getState().tracks.filter((t) => t.videoId !== videoId);
  useFavoritesStore.setState({ tracks: next });
  persist(next);
}

export function isFavorite(videoId: string | null): boolean {
  if (!videoId) return false;
  return useFavoritesStore.getState().tracks.some((t) => t.videoId === videoId);
}

/**
 * The next track to play from the collection, advancing the cursor. Null when
 * nothing has been saved yet.
 */
export function nextFavorite(): FavoriteTrack | null {
  const { tracks, cursor } = useFavoritesStore.getState();
  if (!tracks.length) return null;
  const track = tracks[cursor % tracks.length];
  useFavoritesStore.setState({ cursor: (cursor + 1) % tracks.length });
  return track;
}
