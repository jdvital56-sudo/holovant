import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { armWatchdog, SPEAK_WATCHDOG_MS } from "./speakingWatchdog";

/**
 * The hang, as he described it: music plays, the face appears, and then the
 * microphone hears nothing for the rest of the session.
 *
 * `speaking` is raised before the synthesis request is sent and lowered when
 * the audio ends. A request that never answers left it raised forever, and
 * every question is dropped while it is raised.
 */

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("a line that never starts playing", () => {
  it("lets go of the microphone by itself", () => {
    const release = vi.fn();
    armWatchdog(release);
    vi.advanceTimersByTime(SPEAK_WATCHDOG_MS + 1);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("waits long enough that a merely slow reply is never cut", () => {
    // Measured on his machine: a sentence synthesises in 270-450 ms and the
    // longest paragraph in about 1.8 s. Nothing real comes near this.
    const release = vi.fn();
    armWatchdog(release);
    vi.advanceTimersByTime(2000);
    expect(release).not.toHaveBeenCalled();
  });
});

describe("a line that does start playing", () => {
  it("is left alone, which is the direction that must not break", () => {
    // If this fired while audio was playing it would unlatch the guard
    // mid-sentence, and the assistant would start answering its own voice —
    // the exact fault the latch exists to prevent.
    const release = vi.fn();
    const cancel = armWatchdog(release);
    cancel();
    vi.advanceTimersByTime(SPEAK_WATCHDOG_MS * 3);
    expect(release).not.toHaveBeenCalled();
  });

  it("cancelling twice is harmless", () => {
    // Audio can end and error, and both paths cancel.
    const release = vi.fn();
    const cancel = armWatchdog(release);
    cancel();
    cancel();
    vi.advanceTimersByTime(SPEAK_WATCHDOG_MS + 1);
    expect(release).not.toHaveBeenCalled();
  });
});
