import { create } from "zustand";
import type { SearchResult } from "@/app/api/search/route";

export type PlayStatus = "idle" | "finding" | "opened" | "notFound" | "blocked" | "error";

interface PlayState {
  status: PlayStatus;
  query: string;
  title: string | null;
  url: string | null;
}

export const usePlayStore = create<PlayState>(() => ({
  status: "idle",
  query: "",
  title: null,
  url: null,
}));

/** Watch pages play; channel and results pages do not. */
function isPlayable(result: SearchResult): boolean {
  return /youtube\.com\/watch|youtu\.be\//i.test(result.url);
}

export function clearPlayback() {
  usePlayStore.setState({ status: "idle", query: "", title: null, url: null });
}

/**
 * Finds a track and opens it.
 *
 * A browser tab cannot start audio on another site, so "play" here means
 * finding the right video and opening it — which is what actually produces
 * sound. Saying so plainly beats the module's old promise to "find and open a
 * track" while nothing was implemented behind it.
 */
export async function playTrack(query: string): Promise<PlayStatus> {
  usePlayStore.setState({ status: "finding", query, title: null, url: null });

  try {
    const response = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: `${query} official audio youtube` }),
    });

    if (!response.ok) {
      usePlayStore.setState({ status: "error" });
      return "error";
    }

    const payload = (await response.json()) as { results?: SearchResult[] };
    const track = (payload.results ?? []).find(isPlayable);

    if (!track) {
      usePlayStore.setState({ status: "notFound" });
      return "notFound";
    }

    usePlayStore.setState({ status: "opened", title: track.title, url: track.url });

    // Opened rather than embedded: an embed is blocked for a large share of
    // music videos, which would look like the player simply failing.
    const opened = window.open(track.url, "_blank", "noopener,noreferrer");
    if (!opened) {
      // The pop-up was blocked; the link is kept so it can be clicked instead.
      usePlayStore.setState({ status: "blocked" });
      return "blocked";
    }

    return "opened";
  } catch {
    usePlayStore.setState({ status: "error" });
    return "error";
  }
}
