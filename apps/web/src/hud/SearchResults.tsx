"use client";

import { useSearchStore, clearSearch } from "@/voice/searchStore";

/**
 * Web results, opened by voice. Rendered as an overlay panel rather than in the
 * 3D ring: results are read, and text meant to be read should not be sitting on
 * a surface that drifts.
 */
export function SearchResults() {
  const status = useSearchStore((s) => s.status);
  const query = useSearchStore((s) => s.query);
  const results = useSearchStore((s) => s.results);
  const errorMessage = useSearchStore((s) => s.errorMessage);

  if (status === "idle") return null;

  return (
    <div
      translate="no"
      className="pointer-events-auto fixed right-4 top-28 z-30 w-[min(420px,calc(100vw-2rem))] rounded-2xl border border-signal/25 bg-[rgba(10,16,26,0.88)] p-4 backdrop-blur-xl sm:right-8"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-mist">Web search</div>
          <div className="truncate font-display text-sm font-semibold text-frost">{query}</div>
        </div>
        <button
          type="button"
          onClick={clearSearch}
          className="shrink-0 cursor-pointer font-mono text-[11px] text-mist transition-colors hover:text-frost"
        >
          CLOSE
        </button>
      </div>

      {status === "searching" && (
        <div className="flex items-center gap-2 py-3 font-mono text-[12px] text-mist">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal" />
          searching…
        </div>
      )}

      {status === "error" && <div className="py-2 text-[12px] text-warn">{errorMessage}</div>}

      {status === "done" && results.length === 0 && (
        <div className="py-2 font-mono text-[12px] text-mist">nothing found</div>
      )}

      {status === "done" && results.length > 0 && (
        <ol className="max-h-[52vh] space-y-3 overflow-y-auto pr-1">
          {results.map((result, i) => (
            <li key={result.url} className="border-b border-white/8 pb-3 last:border-0 last:pb-0">
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block"
              >
                <div className="flex gap-2">
                  <span className="font-mono text-[11px] text-signal/70">{i + 1}</span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium leading-snug text-frost group-hover:text-signal">
                      {result.title}
                    </div>
                    {result.description && (
                      <div className="mt-1 line-clamp-3 text-[12px] leading-relaxed text-mist">
                        {result.description}
                      </div>
                    )}
                    <div className="mt-1 truncate font-mono text-[10px] text-mist/60">
                      {new URL(result.url).hostname.replace(/^www\./, "")}
                    </div>
                  </div>
                </div>
              </a>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
