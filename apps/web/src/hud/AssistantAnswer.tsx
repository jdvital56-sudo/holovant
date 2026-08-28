"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useChatStore } from "@/voice/chatStore";
import { forSpeech } from "@/voice/speech";
import { useVitaStore } from "@/stores/vitaStore";

/**
 * The assistant's answer, on screen while it is also being spoken.
 *
 * Speech alone is not enough: a name, a number or a spelling has to be seen to
 * be usable, and anything missed out loud is otherwise gone.
 */
export function AssistantAnswer() {
  const status = useChatStore((s) => s.status);
  const partial = useChatStore((s) => s.partial);
  const history = useChatStore((s) => s.history);
  const errorMessage = useChatStore((s) => s.errorMessage);
  const vitaVisible = useVitaStore((s) => s.visible);

  // While Vita's face is up the screen is just the face on black — no panels.
  if (vitaVisible) return null;

  const lastAnswer = [...history].reverse().find((turn) => turn.role === "assistant");
  // Strip markdown the model emits despite being told not to — the same clean
  // that the spoken side gets, so the panel never shows a raw "**".
  const shown = forSpeech(partial || (status === "idle" ? lastAnswer?.content ?? "" : "") || "");
  const visible = status === "thinking" || status === "streaming" || status === "error" || Boolean(shown);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ type: "spring", stiffness: 240, damping: 26 }}
          translate="no"
          className="pointer-events-none fixed bottom-24 left-1/2 z-30 w-[min(680px,calc(100vw-3rem))] -translate-x-1/2"
        >
          <div className="rounded-2xl border border-signal/25 bg-[rgba(10,16,26,0.86)] px-5 py-4 backdrop-blur-xl">
            <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-mist">
              <span
                className={[
                  "h-1.5 w-1.5 rounded-full",
                  status === "error" ? "bg-warn" : "bg-signal",
                  status === "thinking" || status === "streaming" ? "animate-pulse" : "",
                ].join(" ")}
              />
              {status === "thinking"
                ? "thinking"
                : status === "streaming"
                  ? "answering"
                  : status === "error"
                    ? "problem"
                    : "answer"}
            </div>

            <p className="max-h-[30vh] overflow-y-auto text-[15px] leading-relaxed text-frost">
              {status === "error" ? errorMessage : shown}
              {status === "streaming" && (
                <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-[2px] animate-pulse bg-signal" />
              )}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
