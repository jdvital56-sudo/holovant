"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePlayStore, clearPlayback } from "@/voice/playMusic";

/**
 * The found track, playable inside Holovant.
 *
 * The player is embedded rather than opened in a tab because a page may only
 * open tabs or start audible sound in direct response to a click — a spoken
 * command is not one, and attempting it anyway was blocked every time. Voice
 * finds the track; one click on the player starts it, which is the only part
 * a browser insists a human does.
 */
export function NowPlaying() {
  const status = usePlayStore((s) => s.status);
  const query = usePlayStore((s) => s.query);
  const title = usePlayStore((s) => s.title);
  const url = usePlayStore((s) => s.url);
  const videoId = usePlayStore((s) => s.videoId);

  if (status === "idle") return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        translate="no"
        className="pointer-events-auto fixed left-4 top-28 z-30 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-signal/25 bg-[rgba(10,16,26,0.9)] backdrop-blur-xl sm:left-8"
      >
        <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-mist">
            {status === "finding" ? "finding" : status === "ready" ? "press play" : "music"}
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
          <div className="flex items-center gap-2 px-4 pb-4 font-mono text-[12px] text-mist">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal" />
            {query}
          </div>
        )}

        {status === "notFound" && (
          <div className="px-4 pb-4 text-[13px] text-mist">Nothing playable found for “{query}”.</div>
        )}

        {status === "error" && (
          <div className="px-4 pb-4 text-[13px] text-warn">Could not reach search.</div>
        )}

        {videoId && (
          <>
            <div className="aspect-video w-full bg-black">
              <iframe
                key={videoId}
                src={`https://www.youtube-nocookie.com/embed/${videoId}`}
                title={title ?? "Track"}
                className="h-full w-full"
                allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <div className="px-4 pb-3 pt-2">
              <div className="text-[13px] font-medium leading-snug text-frost">{title}</div>
              {/* Some videos forbid embedding; the link is the way out of that. */}
              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block font-mono text-[10px] text-mist/70 hover:text-signal"
                >
                  open on youtube
                </a>
              )}
            </div>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
