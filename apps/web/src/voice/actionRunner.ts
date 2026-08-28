"use client";

import { create } from "zustand";
import type { ModuleId } from "@holovant/module-contracts";
import { moduleRegistry } from "@/modules/registry";
import { useOrbitStore } from "@/stores/orbitStore";
import { showVita, hideVita } from "@/stores/vitaStore";
import { nudgeVolume } from "@/audio/volumeStore";
import { playTrack, playSavedTrack, commandPlayer, usePlayStore } from "./playMusic";
import { saveTrack, nextFrom } from "./playlistStore";
import { isSafeUrl, type QueuedAction } from "@/server/actionTypes";

/**
 * Carrying out what the assistant decided to do.
 *
 * The server chooses the action; this performs it, because the interface is
 * here. Everything is done immediately and without confirmation, with one
 * exception: a browser refuses to open a tab unless a person clicked something,
 * so a blocked link becomes a chip the user taps once. That is a rule of the
 * browser, not a choice — and pretending otherwise would be the sort of empty
 * promise this project is trying not to make.
 */

export interface PendingLink {
  url: string;
  title: string;
}

interface ActionState {
  /** A link the browser would not open by itself. One tap sends it through. */
  pendingLink: PendingLink | null;
  /** What was done recently, newest first, so the user can see it happened. */
  recent: Array<{ label: string; at: number }>;
  /** True once a popup has been blocked, so the hint is only ever shown once. */
  popupsBlocked: boolean;
}

export const useActionStore = create<ActionState>(() => ({
  pendingLink: null,
  recent: [],
  popupsBlocked: false,
}));

const RECENT_LIMIT = 4;

/** How long a line stays on screen before it clears itself. */
const NOTE_LIFETIME_MS = 8000;

function note(label: string) {
  const at = Date.now();
  useActionStore.setState((s) => ({
    recent: [{ label, at }, ...s.recent].slice(0, RECENT_LIMIT),
  }));
  // Expired here rather than filtered during render: reading the clock while
  // rendering makes the same component draw differently for the same state.
  setTimeout(() => {
    useActionStore.setState((s) => ({ recent: s.recent.filter((r) => r.at !== at) }));
  }, NOTE_LIFETIME_MS);
}

export function clearPendingLink() {
  useActionStore.setState({ pendingLink: null });
}

/** Opens the link the browser refused to open on its own. Called from a click. */
export function openPendingLink() {
  const pending = useActionStore.getState().pendingLink;
  if (!pending) return;
  window.open(pending.url, "_blank", "noopener,noreferrer");
  useActionStore.setState({ pendingLink: null });
  note(pending.title || pending.url);
}

function moduleIdFor(name: string): ModuleId | null {
  const wanted = name.trim().toLowerCase();
  const found =
    moduleRegistry.find((m) => m.id === wanted) ??
    moduleRegistry.find((m) => m.label.toLowerCase() === wanted) ??
    moduleRegistry.find((m) => m.id.startsWith(wanted) || wanted.startsWith(m.id));
  return found?.id ?? null;
}

/**
 * Runs one action. Returns a short line describing what happened, or null when
 * nothing could be done — the caller says so rather than letting the model's
 * claim stand unchallenged.
 */
export function runAction(queued: QueuedAction): string | null {
  const { action, args } = queued;

  switch (action) {
    case "open_module": {
      const id = moduleIdFor(args.module ?? "");
      if (!id) return null;
      hideVita();
      useOrbitStore.getState().dispatch({ type: "expand", cardId: id, source: "voice" });
      const label = moduleRegistry.find((m) => m.id === id)?.label ?? id;
      note(`Открыл ${label}`);
      return label;
    }

    case "play_music":
      hideVita();
      void playTrack(args.query ?? "");
      note(args.query ? `Включил ${args.query}` : "Включил музыку");
      return args.query || "музыку";

    case "pause_music":
      if (!commandPlayer("pause")) return null;
      note("Пауза");
      return "пауза";

    case "resume_music":
      if (!commandPlayer("resume")) return null;
      note("Продолжил");
      return "продолжил";

    case "play_collection": {
      const picked = nextFrom(args.name || null);
      if (!picked) return null;
      hideVita();
      playSavedTrack(picked.track);
      note(`Включил «${picked.playlist.name}»`);
      return picked.playlist.name;
    }

    case "save_track": {
      const now = usePlayStore.getState();
      if (!now.videoId || !now.title) return null;
      const outcome = saveTrack(
        { videoId: now.videoId, title: now.title, url: now.url ?? "" },
        args.collection || null,
      );
      note(`Сохранил в «${outcome.playlist.name}»`);
      return outcome.playlist.name;
    }

    case "open_site": {
      const url = args.url ?? "";
      if (!isSafeUrl(url)) return null;
      const title = args.title || url;
      // A page may only open a tab in response to a click. Where the user has
      // allowed popups for this site it goes straight through; where they have
      // not, it becomes one tap rather than a silent failure.
      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (opened) {
        note(`Открыл ${title}`);
        return title;
      }
      useActionStore.setState({ pendingLink: { url, title }, popupsBlocked: true });
      return title;
    }

    case "set_volume": {
      let level = nudgeVolume(args.direction === "down" ? "down" : "up");
      if (level <= 0.001) level = nudgeVolume("up");
      note(`Громкость ${Math.round(level * 100)}%`);
      return `${Math.round(level * 100)}%`;
    }

    case "show_face":
      showVita();
      note("Показал лицо");
      return "лицо";

    case "hide_face":
      hideVita();
      note("Скрыл лицо");
      return "лицо";

    default:
      return null;
  }
}
