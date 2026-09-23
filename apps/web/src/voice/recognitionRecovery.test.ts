import { describe, expect, it } from "vitest";
import { MAX_RETRIES, recoveryFor } from "./recognitionRecovery";

/**
 * The fault he described as "ничего не слышит": the microphone worked for the
 * first command or two and then went permanently deaf.
 *
 * Any error code at all used to stop the recogniser for good. "aborted" is
 * raised by Chrome as a matter of course — cutting the voice mid-sentence
 * causes one — so the thing that made it deaf was the app's own behaviour.
 */
describe("when the recogniser reports an error", () => {
  it("carries on after the one Chrome raises constantly", () => {
    // This is the whole bug in one row.
    expect(recoveryFor("aborted", 0, "ru")).toMatchObject({ action: "retry" });
    expect(recoveryFor("aborted", 20, "ru")).toMatchObject({ action: "retry" });
  });

  it("does not count silence against it", () => {
    // "no-speech" fires throughout any pause in talking. Counting those would
    // use up every retry while nothing was wrong.
    expect(recoveryFor("no-speech", MAX_RETRIES + 10, "ru")).toMatchObject({ action: "retry" });
  });

  it("tries a real fault again before giving up on it", () => {
    expect(recoveryFor("network", 0, "ru")).toMatchObject({ action: "retry" });
    expect(recoveryFor("audio-capture", 1, "ru")).toMatchObject({ action: "retry" });
    expect(recoveryFor("something-new", 2, "ru")).toMatchObject({ action: "retry" });
  });

  it("waits longer each time rather than hammering", () => {
    const first = recoveryFor("network", 0, "ru");
    const later = recoveryFor("network", 3, "ru");
    expect(first.action).toBe("retry");
    expect(later.action).toBe("retry");
    if (first.action === "retry" && later.action === "retry") {
      expect(later.delayMs).toBeGreaterThan(first.delayMs);
    }
  });

  it("stops at once when the microphone is refused, because retrying cannot help", () => {
    // The direction that must survive the fix: a permission denial is not a
    // blip, and retrying it forever would hide it.
    for (const code of ["not-allowed", "service-not-allowed"]) {
      const said = recoveryFor(code, 0, "ru");
      expect(said.action, code).toBe("give-up");
      expect(said.message, code).toContain("Микрофон");
    }
  });

  it("gives up on a real fault once it has been tried enough", () => {
    const said = recoveryFor("network", MAX_RETRIES, "ru");
    expect(said.action).toBe("give-up");
    expect(said.message).toContain("сеть");
  });

  it("says an unknown code rather than shrugging", () => {
    const said = recoveryFor("weird-thing", MAX_RETRIES, "ru");
    expect(said.action).toBe("give-up");
    expect(said.message).toContain("weird-thing");
  });

  it("speaks to him in Russian and to everyone else in English", () => {
    // Every message he can see is in Russian; this was the one corner of the
    // screen still answering in English.
    const ru = recoveryFor("not-allowed", 0, "ru");
    const en = recoveryFor("not-allowed", 0, "en");
    expect(ru.action).toBe("give-up");
    expect(en.action).toBe("give-up");
    if (ru.action === "give-up" && en.action === "give-up") {
      expect(ru.message).not.toBe(en.message);
      expect(en.message).toContain("microphone");
    }
  });
});
