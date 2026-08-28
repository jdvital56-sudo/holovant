"use client";

import { create } from "zustand";

/**
 * The user's own music, kept in named collections.
 *
 * It began as one flat list of favourites, which answers "включи избранное"
 * and nothing else. He asked for collections he can name — one for work, one
 * to relax to — because that is how a person actually keeps music.
 *
 * Held in localStorage: this is a personal list on one machine, not something
 * that belongs on a server or is shared between people.
 */

export interface SavedTrack {
  videoId: string;
  title: string;
  url: string;
  savedAt: number;
}

export interface Playlist {
  /** Stable key, derived from the name when it is created. */
  id: string;
  /** As the user said it, which is also how it is read back to them. */
  name: string;
  tracks: SavedTrack[];
  /** Rotates, so asking twice plays two different tracks. */
  cursor: number;
}

interface PlaylistState {
  playlists: Playlist[];
}

const KEY = "holovant.playlists.v1";
/** The flat list this replaced. Read once, then left alone. */
const LEGACY_KEY = "holovant.favorites.v1";

/** Where a track goes when no collection is named. */
export const DEFAULT_PLAYLIST_ID = "favourites";
const DEFAULT_PLAYLIST_NAME = "Избранное";

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "") || `list-${Date.now()}`
  );
}

/** Comparable form: case, punctuation and the small words a person drops. */
export function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/(^|\s)(для|под|на|the|for)(\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isTrack(value: unknown): value is SavedTrack {
  const t = value as SavedTrack;
  return Boolean(t) && typeof t.videoId === "string" && typeof t.title === "string";
}

function load(): Playlist[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .filter((p): p is Playlist => {
            const list = p as Playlist;
            return Boolean(list) && typeof list.id === "string" && Array.isArray(list.tracks);
          })
          .map((p) => ({ ...p, tracks: p.tracks.filter(isTrack), cursor: p.cursor ?? 0 }));
      }
    }

    // Nothing saved in the new shape. Anything kept under the old flat key is
    // still the user's music, so it becomes their first collection rather than
    // disappearing the day the feature grew.
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const tracks = (JSON.parse(legacy) as unknown[]).filter(isTrack);
      if (tracks.length) {
        return [
          { id: DEFAULT_PLAYLIST_ID, name: DEFAULT_PLAYLIST_NAME, tracks, cursor: 0 },
        ];
      }
    }
  } catch {
    // Unreadable storage means starting empty, not failing to load the app.
  }
  return [];
}

export const usePlaylistStore = create<PlaylistState>(() => ({ playlists: load() }));

function persist(playlists: Playlist[]) {
  usePlaylistStore.setState({ playlists });
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(playlists));
  } catch {
    // Storage blocked or full; the collection just will not survive a reload.
  }
}

/**
 * Finds a collection by what the user called it, forgivingly: they will say
 * "подборка для работы" one day and "рабочая" the next, and a list they cannot
 * name is a list they cannot use.
 */
export function findPlaylist(spoken: string): Playlist | null {
  const { playlists } = usePlaylistStore.getState();
  if (!playlists.length) return null;

  const wanted = normaliseName(spoken);
  if (!wanted) return null;

  const exact = playlists.find((p) => normaliseName(p.name) === wanted);
  if (exact) return exact;

  const contains = playlists.find((p) => {
    const name = normaliseName(p.name);
    return name.includes(wanted) || wanted.includes(name);
  });
  if (contains) return contains;

  // Last resort: any significant word in common, so "работа" finds "для работы".
  const words = wanted.split(" ").filter((w) => w.length >= 4);
  return (
    playlists.find((p) => {
      const name = normaliseName(p.name);
      return words.some((w) => name.includes(w.slice(0, Math.max(4, w.length - 2))));
    }) ?? null
  );
}

export function listPlaylists(): Playlist[] {
  return usePlaylistStore.getState().playlists;
}

export interface SaveOutcome {
  playlist: Playlist;
  /** False when the track was already in that collection. */
  added: boolean;
  created: boolean;
}

export function saveTrack(track: Omit<SavedTrack, "savedAt">, playlistName?: string | null): SaveOutcome {
  const playlists = [...usePlaylistStore.getState().playlists];

  let index = playlistName
    ? playlists.findIndex((p) => p.id === (findPlaylist(playlistName)?.id ?? ""))
    : playlists.findIndex((p) => p.id === DEFAULT_PLAYLIST_ID);

  let created = false;
  if (index < 0) {
    const name = playlistName?.trim() || DEFAULT_PLAYLIST_NAME;
    playlists.push({
      id: playlistName ? slugify(name) : DEFAULT_PLAYLIST_ID,
      name,
      tracks: [],
      cursor: 0,
    });
    index = playlists.length - 1;
    created = true;
  }

  const target = playlists[index];
  if (target.tracks.some((t) => t.videoId === track.videoId)) {
    return { playlist: target, added: false, created };
  }

  playlists[index] = {
    ...target,
    tracks: [...target.tracks, { ...track, savedAt: Date.now() }],
  };
  persist(playlists);
  return { playlist: playlists[index], added: true, created };
}

export function removeTrack(videoId: string, playlistId?: string) {
  const playlists = usePlaylistStore.getState().playlists.map((p) =>
    playlistId && p.id !== playlistId
      ? p
      : { ...p, tracks: p.tracks.filter((t) => t.videoId !== videoId) },
  );
  persist(playlists);
}

export function isSaved(videoId: string | null): boolean {
  if (!videoId) return false;
  return usePlaylistStore
    .getState()
    .playlists.some((p) => p.tracks.some((t) => t.videoId === videoId));
}

/**
 * The next track from a named collection, advancing its cursor. Null when the
 * collection does not exist or has nothing in it — the caller says which,
 * because "нет такой подборки" and "она пустая" are different problems.
 */
export function nextFrom(playlistName?: string | null): { track: SavedTrack; playlist: Playlist } | null {
  const { playlists } = usePlaylistStore.getState();
  const target = playlistName
    ? findPlaylist(playlistName)
    : (playlists.find((p) => p.id === DEFAULT_PLAYLIST_ID) ?? playlists.find((p) => p.tracks.length));

  if (!target || !target.tracks.length) return null;

  const track = target.tracks[target.cursor % target.tracks.length];
  persist(
    playlists.map((p) =>
      p.id === target.id ? { ...p, cursor: (p.cursor + 1) % p.tracks.length } : p,
    ),
  );
  return { track, playlist: target };
}

export function renamePlaylist(id: string, name: string) {
  persist(usePlaylistStore.getState().playlists.map((p) => (p.id === id ? { ...p, name } : p)));
}

export function deletePlaylist(id: string) {
  persist(usePlaylistStore.getState().playlists.filter((p) => p.id !== id));
}
