"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePlayStore, clearPlayback } from "@/voice/playMusic";

/**
 * The track that was found, with its link.
 *
 * The link matters most when the browser blocks the pop-up: the spoken reply
 * says to use the link on screen, and without this there would be no link on
 * screen to use.
 */
export function NowPlaying() {
  const status = usePlayStore((s) => s.status);
  const query = usePlayStore((s) => s.query);
  const title = usePlayStore((s) => s.title);
  const url = usePlayStore((s) => s.url);

  if (status === "idle") return null;

  const blocked = status === "blocked";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        translate="no"
        className="pointer-events-auto fixed left-4 top-28 z-30 w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-signal/25 bg-[rgba(10,16,26,0.88)] p-4 backdrop-blur-xl sm:left-8"
      >
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-mist">
            {status === "finding" ? "finding" : blocked ? "pop-up blocked" : "now playing"}
          </div>
          <button
            type="button"
            onClick={clearPlayback}
            className="shrink-0 cursor-pointer font-mono text-[11px] text-mist transition-colors hover:text-frost"
          >
            CLOSE
          </button>
        </div>

        {status === "finding" && (
          <div className="flex items-center gap-2 font-mono text-[12px] text-mist">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal" />
            {query}
          </div>
        )}

        {status === "notFound" && (
          <div className="text-[13px] text-mist">Nothing playable found for “{query}”.</div>
        )}

        {status === "error" && <div className="text-[13px] text-warn">Could not reach search.</div>}

        {url && (
          <>
            {blocked && (
              <p className="mb-2 text-[12px] leading-snug text-warn">
                The browser stopped it opening. Use the link below.
              </p>
            )}
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-[13px] font-medium leading-snug text-frost hover:text-signal"
            >
              {title ?? url}
            </a>
            <div className="mt-1 truncate font-mono text-[10px] text-mist/60">
              {new URL(url).hostname.replace(/^www\./, "")}
            </div>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
