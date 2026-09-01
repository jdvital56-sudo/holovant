"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { askAssistant, useChatStore } from "@/voice/chatStore";
import { forSpeech } from "@/voice/speech";
import { useVitaStore } from "@/stores/vitaStore";
import { useOrbitStore } from "@/stores/orbitStore";
import { findModule } from "@/modules/briefing";
import { ASSISTANT_NAME } from "@/config/assistant";

/**
 * The conversation, folded away into a mark at the bottom of the screen.
 *
 * It used to sit open across the middle whenever there was anything to say,
 * and stay there: he asked for his music and was left reading the answer about
 * it. What is spoken is already spoken — the panel exists for the things
 * speech cannot carry, a name, a number, a spelling, and for typing when
 * talking is not wanted.
 *
 * So it opens only when he opens it. An answer arriving while it is folded
 * away marks the badge and says nothing on screen, because he asked not to be
 * shown what it is saying next.
 */
export function AssistantAnswer() {
  const status = useChatStore((s) => s.status);
  const partial = useChatStore((s) => s.partial);
  const history = useChatStore((s) => s.history);
  const errorMessage = useChatStore((s) => s.errorMessage);
  const vitaVisible = useVitaStore((s) => s.visible);
  const expandedId = useOrbitStore((s) => s.expandedId);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [seenAnswers, setSeenAnswers] = useState(0);
  const scroller = useRef<HTMLDivElement | null>(null);

  const answers = history.filter((turn) => turn.role === "assistant").length;
  // Derived rather than stored: something arrived after he folded it away.
  const unread = !open && answers > seenAnswers;

  useEffect(() => {
    if (!open) return;
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [open, history.length, partial]);

  // While the face is up the screen is just the face on black — no panels.
  if (vitaVisible) return null;

  // Strip markdown the model emits despite being told not to, the same clean
  // the spoken side gets, so the panel never shows a raw "**".
  const streaming = status === "thinking" || status === "streaming";
  const live = forSpeech(partial);

  function send() {
    const question = draft.trim();
    if (!question || streaming) return;
    setDraft("");
    const openModule = expandedId ? findModule(expandedId) : undefined;
    void askAssistant(question, openModule?.label ?? null, "ru");
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ type: "spring", stiffness: 240, damping: 26 }}
            translate="no"
            className="pointer-events-auto fixed bottom-20 left-1/2 z-30 flex w-[min(680px,calc(100vw-3rem))] -translate-x-1/2 flex-col rounded-2xl border border-signal/25 bg-[rgba(10,16,26,0.9)] backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-signal/15 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-mist">
              <span className="flex items-center gap-2">
                <span
                  className={[
                    "h-1.5 w-1.5 rounded-full",
                    status === "error" ? "bg-warn" : "bg-signal",
                    streaming ? "animate-pulse" : "",
                  ].join(" ")}
                />
                {ASSISTANT_NAME}
              </span>
              <button
                type="button"
                onClick={() => {
                  setSeenAnswers(answers);
                  setOpen(false);
                }}
                className="uppercase tracking-[0.2em] text-mist transition-colors hover:text-frost"
              >
                свернуть
              </button>
            </div>

            <div ref={scroller} className="flex max-h-[45vh] flex-col gap-3 overflow-y-auto px-5 py-4">
              {history.length === 0 && !live && (
                <p className="text-[14px] text-mist">Спросите вслух или напишите здесь.</p>
              )}
              {history.map((turn, index) => (
                <p
                  key={`${index}-${turn.role}`}
                  className={
                    turn.role === "user"
                      ? "self-end max-w-[85%] rounded-xl bg-signal/15 px-3 py-2 text-[15px] leading-relaxed text-frost"
                      : "max-w-[92%] text-[15px] leading-relaxed text-frost"
                  }
                >
                  {turn.role === "user" ? turn.content : forSpeech(turn.content)}
                </p>
              ))}
              {live && <p className="max-w-[92%] text-[15px] leading-relaxed text-frost">{live}</p>}
              {status === "error" && <p className="text-[15px] leading-relaxed text-warn">{errorMessage}</p>}
              {status === "thinking" && !live && <p className="text-[14px] text-mist">Думаю…</p>}
            </div>

            <div className="flex items-center gap-2 border-t border-signal/15 px-3 py-3">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") send();
                  // The scene listens for arrows and Escape; a field being
                  // typed into is not the scene.
                  event.stopPropagation();
                }}
                placeholder="Написать…"
                className="min-w-0 flex-1 rounded-lg border border-signal/20 bg-[rgba(6,11,18,0.8)] px-3 py-2 text-[15px] text-frost outline-none placeholder:text-mist/60 focus:border-signal/60"
              />
              <button
                type="button"
                onClick={send}
                disabled={!draft.trim() || streaming}
                className="rounded-lg border border-signal/30 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.15em] text-frost transition-colors hover:border-signal disabled:opacity-40"
              >
                отправить
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => {
          // Closing marks everything said so far as seen, so the dot means
          // "since you last looked" rather than "ever".
          if (open) setSeenAnswers(answers);
          setOpen((was) => !was);
        }}
        aria-label={open ? "Свернуть чат" : "Открыть чат"}
        className="pointer-events-auto fixed bottom-6 right-6 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-signal/30 bg-[rgba(10,16,26,0.8)] backdrop-blur-md transition-colors hover:border-signal"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path
            d="M4 5.5h16v10H9l-5 4v-14z"
            className="text-signal"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {/* Something was said while it was folded away. Marked, not shown. */}
        {(unread || streaming) && !open && (
          <span
            className={[
              "absolute right-1 top-1 h-2 w-2 rounded-full bg-signal shadow-[0_0_8px_rgba(111,179,255,0.8)]",
              streaming ? "animate-pulse" : "",
            ].join(" ")}
          />
        )}
      </button>
    </>
  );
}
