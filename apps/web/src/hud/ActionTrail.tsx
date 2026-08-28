"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useActionStore, openPendingLink, clearPendingLink } from "@/voice/actionRunner";
import { useVitaStore } from "@/stores/vitaStore";

/**
 * What the assistant just did, and the one thing it could not do alone.
 *
 * The trail matters because an action is over before it can be described: the
 * module is already open, the track already playing. Without a line saying so,
 * a command that worked and one that was misheard look the same afterwards.
 *
 * The link is the browser's rule, not ours — a page may only open a tab in
 * response to a click. Where the user has allowed popups for this site it never
 * appears; where they have not, one tap is better than a silent failure or a
 * promise that was not kept.
 */
export function ActionTrail() {
  const pendingLink = useActionStore((s) => s.pendingLink);
  const recent = useActionStore((s) => s.recent);
  const faceUp = useVitaStore((s) => s.visible);

  // While the face is on screen there is nothing but the face, by his request.
  if (faceUp) return null;

  return (
    <div className="pointer-events-none fixed bottom-24 right-4 z-30 flex w-[min(320px,calc(100vw-2rem))] flex-col items-end gap-2 sm:right-8">
      <AnimatePresence>
        {pendingLink && (
          <motion.div
            key="pending"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="pointer-events-auto w-full rounded-2xl border border-signal/30 bg-[rgba(10,16,26,0.92)] p-3 backdrop-blur-xl"
          >
            <div className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-mist">
              браузер просит подтверждения
            </div>
            <div className="mb-2 truncate text-[13px] text-frost">{pendingLink.title}</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openPendingLink}
                className="cursor-pointer rounded-full bg-signal/20 px-3 py-1 font-mono text-[11px] text-signal transition-colors hover:bg-signal/30"
              >
                ОТКРЫТЬ
              </button>
              <button
                type="button"
                onClick={clearPendingLink}
                className="cursor-pointer font-mono text-[11px] text-mist transition-colors hover:text-frost"
              >
                ОТМЕНА
              </button>
            </div>
            <div className="mt-2 text-[10px] leading-snug text-mist/60">
              Чтобы ссылки открывались сами — разрешите всплывающие окна для этого сайта в
              настройках браузера.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {recent.map((entry) => (
          <motion.div
            key={entry.at}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-[rgba(10,16,26,0.7)] px-3 py-1 backdrop-blur-md"
          >
            <span className="h-1 w-1 rounded-full bg-signal" />
            <span className="font-mono text-[10px] text-mist">{entry.label}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
