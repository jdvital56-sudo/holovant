import { create } from "zustand";

export interface BrainNote {
  path: string;
  title: string;
  excerpt: string;
  score: number;
}

export type BrainStatus = "idle" | "searching" | "ready" | "notConnected" | "error";

interface BrainState {
  status: BrainStatus;
  query: string;
  notes: BrainNote[];
  connected: boolean | null;
  noteCount: number;
}

export const useBrainStore = create<BrainState>(() => ({
  status: "idle",
  query: "",
  notes: [],
  connected: null,
  noteCount: 0,
}));

let activeRequest = 0;

/** Whether a knowledge base is connected, and how much is in it. */
export async function loadBrainStats(): Promise<{ connected: boolean; noteCount: number }> {
  try {
    const response = await fetch("/api/brain");
    const payload = (await response.json()) as { connected: boolean; noteCount: number };
    useBrainStore.setState({ connected: payload.connected, noteCount: payload.noteCount });
    return payload;
  } catch {
    useBrainStore.setState({ connected: false, noteCount: 0 });
    return { connected: false, noteCount: 0 };
  }
}

export function clearBrain() {
  activeRequest++;
  useBrainStore.setState({ status: "idle", query: "", notes: [] });
}

export async function searchBrain(query: string): Promise<BrainNote[]> {
  const requestId = ++activeRequest;
  useBrainStore.setState({ status: "searching", query, notes: [] });

  try {
    const response = await fetch("/api/brain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    // A slower earlier question must not overwrite a newer one's answer.
    if (requestId !== activeRequest) return [];

    if (response.status === 501) {
      useBrainStore.setState({ status: "notConnected", connected: false });
      return [];
    }
    if (!response.ok) {
      useBrainStore.setState({ status: "error" });
      return [];
    }

    const payload = (await response.json()) as { notes?: BrainNote[] };
    if (requestId !== activeRequest) return [];

    const notes = payload.notes ?? [];
    useBrainStore.setState({ status: "ready", notes, connected: true });
    return notes;
  } catch {
    if (requestId !== activeRequest) return [];
    useBrainStore.setState({ status: "error" });
    return [];
  }
}
