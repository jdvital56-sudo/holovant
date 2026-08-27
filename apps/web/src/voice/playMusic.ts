import { create } from "zustand";
import type { SearchResult } from "@/app/api/search/route";

export type PlayStatus = "idle" | "finding" | "ready" | "notFound" | "error";

interface PlayState {
  status: PlayStatus;
  query: string;
  title: string | null;
  url: string | null;
  /** YouTube id, so the track can be played inside the app rather than elsewhere. */
  videoId: string | null;
}

export const usePlayStore = create<PlayState>(() => ({
  status: "idle",
  query: "",
  title: null,
  url: null,
  videoId: null,
}));

/** Watch pages carry a video; channel and search pages do not. */
function videoIdFrom(url: string): string | null {
  const watch = url.match(/[?&]v=([\w-]{11})/);
  if (watch) return watch[1];
  const short = url.match(/youtu\.be\/([\w-]{11})/);
  return short ? short[1] : null;
}

export function clearPlayback() {
  usePlayStore.setState({ status: "idle", query: "", title: null, url: null, videoId: null });
}

/**
 * Finds a track and puts it in the in-app player.
 *
 * It does not start playback, and cannot: browsers only allow a page to open
 * tabs or start audible sound in direct response to a click, and a spoken
 * command is not one. Trying anyway is what produced "the browser blocked it"
 * on every single request. So voice does the finding — the part worth
 * automating — and the single click browsers insist on starts the sound.
 */
export async function playTrack(query: string): Promise<PlayStatus> {
  usePlayStore.setState({ status: "finding", query, title: null, url: null, videoId: null });

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
    const results = payload.results ?? [];

    for (const result of results) {
      const videoId = videoIdFrom(result.url);
      if (!videoId) continue;
      usePlayStore.setState({
        status: "ready",
        title: result.title,
        url: result.url,
        videoId,
      });
      return "ready";
    }

    usePlayStore.setState({ status: "notFound" });
    return "notFound";
  } catch {
    usePlayStore.setState({ status: "error" });
    return "error";
  }
}
