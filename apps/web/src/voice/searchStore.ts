import { create } from "zustand";
import type { SearchResult } from "@/app/api/search/route";

export type SearchStatus = "idle" | "searching" | "done" | "error";

interface SearchState {
  status: SearchStatus;
  query: string;
  results: SearchResult[];
  errorMessage: string | null;
}

export const useSearchStore = create<SearchState>(() => ({
  status: "idle",
  query: "",
  results: [],
  errorMessage: null,
}));

/** Only the newest search may write results; earlier ones are abandoned. */
let activeRequest = 0;

export async function runSearch(query: string): Promise<SearchResult[]> {
  const requestId = ++activeRequest;
  useSearchStore.setState({ status: "searching", query, results: [], errorMessage: null });

  try {
    const response = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const payload = (await response.json()) as { results?: SearchResult[]; error?: string };

    // A slower earlier search must not overwrite a newer one's answer.
    if (requestId !== activeRequest) return [];

    if (!response.ok) {
      useSearchStore.setState({ status: "error", errorMessage: payload.error ?? "Search failed." });
      return [];
    }

    const results = payload.results ?? [];
    useSearchStore.setState({ status: "done", results });
    return results;
  } catch {
    if (requestId !== activeRequest) return [];
    useSearchStore.setState({ status: "error", errorMessage: "Could not reach the search service." });
    return [];
  }
}

export function clearSearch() {
  activeRequest++;
  useSearchStore.setState({ status: "idle", query: "", results: [], errorMessage: null });
}
