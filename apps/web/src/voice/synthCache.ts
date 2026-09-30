/**
 * Synthesised audio, by the exact text it says.
 *
 * Two things were slow for the same reason. Every sentence of an answer was
 * only asked for once the one before it had finished playing, so each join
 * was 200-400 ms of silence and a three-sentence answer arrived in lurches.
 * And the handful of lines the assistant says over and over — "Секунду,
 * проверяю", "Не понял команду" — were synthesised afresh every time.
 *
 * One mechanism fixes both. A line can be asked for before it is needed and
 * collected when it is; the same request is never made twice while one is in
 * flight; and a few lines are kept for good.
 */

export type FetchAudio = (text: string) => Promise<Blob | null>;

export interface SynthCache {
  /** The audio for this line: the one already requested, or a new request. */
  get(text: string): Promise<Blob | null>;
  /** Keeps a line for the life of the page — it will be said again. */
  keep(text: string): void;
  /** Forgets a line that has been played and will not be again. */
  forget(text: string): void;
  /** Drops everything not kept: an answer was cut off, its tail is not wanted. */
  dropTransient(): void;
  size(): number;
}

/** A cut-off answer leaves at most a few lines behind; this is well above it. */
export const MAX_CACHED = 48;

export function createSynthCache(fetchAudio: FetchAudio, max: number = MAX_CACHED): SynthCache {
  // Insertion order is the eviction order.
  const entries = new Map<string, Promise<Blob | null>>();
  const kept = new Set<string>();

  function evict() {
    if (entries.size <= max) return;
    for (const text of entries.keys()) {
      if (entries.size <= max) break;
      // Kept lines are never the ones that make room.
      if (!kept.has(text)) entries.delete(text);
    }
  }

  return {
    get(text) {
      const known = entries.get(text);
      if (known) return known;

      const pending = fetchAudio(text).catch(() => null);
      entries.set(text, pending);
      // A failure is not remembered: the next time this line is wanted it must
      // actually be tried again, not handed the same nothing.
      void pending.then((blob) => {
        if (!blob && entries.get(text) === pending) entries.delete(text);
      });
      evict();
      return pending;
    },
    keep(text) {
      kept.add(text);
    },
    forget(text) {
      if (!kept.has(text)) entries.delete(text);
    },
    dropTransient() {
      for (const text of [...entries.keys()]) {
        if (!kept.has(text)) entries.delete(text);
      }
    },
    size() {
      return entries.size;
    },
  };
}
