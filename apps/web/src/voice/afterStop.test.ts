import { describe, expect, it } from "vitest";
import { afterStop, isStopCommand, withoutStopWords, type StopContext } from "./stopWords";

/**
 * "Если я говорю «стоп», он должен сразу прерываться и говорить: «Да, слушаю
 * вас»." — 2026-10-01. It used to stop in silence, which cannot be told from
 * not having heard, so he said it again while it carried on.
 */

const base: StopContext = {
  rest: "",
  restIsCommand: false,
  restIsEcho: false,
  isFinal: false,
  msSinceLastStop: Number.MAX_SAFE_INTEGER,
};

describe("after «стоп»", () => {
  it("says it is listening", () => {
    expect(afterStop(base)).toBe("acknowledge");
    expect(afterStop({ ...base, isFinal: true })).toBe("acknowledge");
  });

  it("says it once, not again when the final transcript of the same word arrives", () => {
    // Stopped on the partial; the final "стоп" lands a second later.
    expect(afterStop({ ...base, isFinal: true, msSinceLastStop: 1200 })).toBe("silent");
  });

  it("says it again for a new «стоп» a while later", () => {
    expect(afterStop({ ...base, msSinceLastStop: 9000 })).toBe("acknowledge");
  });

  it("carries out a command said in the same breath — the direction that must not break", () => {
    // "стоп и закрой лицо": fixed once already, must not regress.
    const rest = withoutStopWords("стоп и закрой лицо");
    expect(rest).toBe("закрой лицо");
    expect(afterStop({ ...base, rest, restIsCommand: true })).toBe("command");
  });

  it("answers a question said in the same breath, from the final transcript", () => {
    const rest = withoutStopWords("стоп, какие у нас есть проекты");
    expect(afterStop({ ...base, rest, isFinal: true })).toBe("question");
  });

  it("never asks a half-heard question from a partial result", () => {
    // The partial grows word by word; acting on it would ask "какие у".
    expect(afterStop({ ...base, rest: "какие у", isFinal: false })).toBe("acknowledge");
  });

  it("does not answer its own words that arrived with the stop", () => {
    // "сорок девять лир стоп": the first half is the assistant, still audible.
    expect(afterStop({ ...base, rest: "сорок девять лир", isFinal: true, restIsEcho: true })).toBe("acknowledge");
  });
});

describe("the words that stop it", () => {
  it("include the ways he says it", () => {
    for (const said of ["Стоп!", "Стоп, остановись", "хватит", "подожди", "погоди", "стоп и закрой лицо"]) {
      expect(isStopCommand(said), said).toBe(true);
    }
  });

  it("are not words the assistant says itself", () => {
    // Its own voice comes back through the microphone; a word it says that
    // also stops it would cut it off mid-sentence.
    for (const said of ["Этого достаточно для начала", "Хорошо, включаю", "Подождите секунду"]) {
      expect(isStopCommand(said), said).toBe(false);
    }
  });
});
