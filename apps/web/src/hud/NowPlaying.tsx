"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePlayStore, clearPlayback, registerPlayer } from "@/voice/playMusic";
import { useFavoritesStore, addFavorite, removeFavorite } from "@/voice/favoritesStore";
import { useVolumeStore } from "@/audio/volumeStore";

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
  const saved = useFavoritesStore((s) => (videoId ? s.tracks.some((t) => t.videoId === videoId) : false));
  const volume = useVolumeStore((s) => s.level);
  const frameRef = useRef<HTMLIFrameElement>(null);

  // "Сделай громче / тише" moves the shared volume; pass it to the embedded
  // player through the YouTube iframe API. Best-effort — it needs the player
  // to have finished loading, so it is also re-sent whenever the frame loads.
  useEffect(() => {
    const win = frameRef.current?.contentWindow;
    if (!win) return;
    const send = (func: string, args: unknown[]) =>
      win.postMessage(JSON.stringify({ event: "command", func, args }), "*");
    send("setVolume", [Math.round(volume * 100)]);
    if (volume <= 0.001) send("mute", []);
    else send("unMute", []);
  }, [volume, videoId]);

  // Belt and braces: when the track changes or the panel closes, tell the old
  // player to stop as well as unmounting it. An iframe that keeps playing after
  // "выключи музыку" is exactly the broken promise to avoid.
  useEffect(() => {
    const frame = frameRef.current;
    return () => {
      frame?.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func: "stopVideo", args: [] }),
        "*",
      );
    };
  }, [videoId]);

  // Transport and ducking, driven by voice. Registered from here because the
  // panel owns the iframe; the voice layer asks, it does not reach into the DOM.
  useEffect(() => {
    registerPlayer((command) => {
      const win = frameRef.current?.contentWindow;
      if (!win) return;
      const send = (func: string, args: unknown[] = []) =>
        win.postMessage(JSON.stringify({ event: "command", func, args }), "*");
      const level = Math.round(useVolumeStore.getState().level * 100);
      switch (command) {
        case "pause":
          send("pauseVideo");
          break;
        case "resume":
          send("playVideo");
          break;
        // Music through the speakers is the loudest thing the microphone hears.
        // Dropping it to a fifth is what lets a spoken command land at all.
        case "duck":
          send("setVolume", [Math.max(5, Math.round(level * 0.2))]);
          break;
        case "unduck":
          send("setVolume", [level]);
          break;
      }
    });
    return () => registerPlayer(null);
  }, []);

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
          <div className="flex shrink-0 items-center gap-3">
            {videoId && (
              <button
                type="button"
                onClick={() =>
                  saved
                    ? removeFavorite(videoId)
                    : addFavorite({ videoId, title: title ?? "Track", url: url ?? "" })
                }
                title={saved ? "remove from favorites" : "save to favorites"}
                className={`cursor-pointer font-mono text-[11px] transition-colors ${
                  saved ? "text-signal" : "text-mist hover:text-frost"
                }`}
              >
                {saved ? "★ SAVED" : "☆ SAVE"}
              </button>
            )}
            <button
              type="button"
              onClick={clearPlayback}
              className="cursor-pointer font-mono text-[11px] text-mist transition-colors hover:text-frost"
            >
              CLOSE
            </button>
          </div>
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
                ref={frameRef}
                // autoplay=1 starts it without the click where Chrome's media
                // engagement allows; where it does not, the player is right
                // here and the "press play" label says so. enablejsapi lets
                // "сделай громче / тише" reach it.
                src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&enablejsapi=1`}
                title={title ?? "Track"}
                className="h-full w-full"
                allow="autoplay; accelerometer; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                onLoad={() => {
                  const win = frameRef.current?.contentWindow;
                  if (!win) return;
                  win.postMessage(
                    JSON.stringify({
                      event: "command",
                      func: "setVolume",
                      args: [Math.round(useVolumeStore.getState().level * 100)],
                    }),
                    "*",
                  );
                }}
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
