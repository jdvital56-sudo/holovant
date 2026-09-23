import { describe, expect, it } from "vitest";
import { failureMessage } from "./requestFailure";

/**
 * The fortnight this is meant to prevent: every POST the page sent was being
 * refused with 403, and all he was ever told was "Не смог получить ответ".
 * Questions, music, favourites and memory all failed, and all four looked like
 * the same shrug.
 */
describe("what he is told when a request fails", () => {
  it("names the perimeter, and the address that fixes it", () => {
    const said = failureMessage(403, "ru");
    expect(said).toContain("localhost:3000");
    expect(said).not.toBe("Не смог получить ответ");
  });

  it("tells a missing key from a refused request from a silent server", () => {
    // Three different faults with three different fixes. They used to share
    // one sentence, which is why the middle one went unnoticed for weeks.
    const key = failureMessage(501, "ru");
    const refused = failureMessage(403, "ru");
    const dead = failureMessage(null, "ru");
    expect(new Set([key, refused, dead]).size).toBe(3);
    expect(dead).toContain("не запущен");
  });

  it("says the number when it has nothing better to say", () => {
    // Not a shrug: a number he can read back to me.
    expect(failureMessage(502, "ru")).toContain("502");
    expect(failureMessage(418, "en")).toContain("418");
  });

  it("still says the thing about the key it always said", () => {
    // The direction that must not be lost: 501 already had a real message and
    // it was the only one that did.
    expect(failureMessage(501, "ru")).toContain("ключ");
    expect(failureMessage(501, "en")).toContain("key");
  });

  it("answers in both languages", () => {
    for (const status of [501, 403, 401, 429, 400, 502, null]) {
      expect(failureMessage(status, "ru"), `ru ${status}`).not.toBe(
        failureMessage(status, "en"),
      );
    }
  });
});
