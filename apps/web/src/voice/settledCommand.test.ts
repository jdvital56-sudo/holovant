import { describe, expect, it } from "vitest";
import { matchIntent } from "./commandEngine";
import { isTailOfSpeech } from "./echo";
import { canActOnPartial, commandAtEnd, intentKey, isRepeatOf, REPEAT_MS } from "./settledCommand";

/**
 * "Музыка, пауза, либо сделать тише, либо стоп. Nothing happens." and "убери
 * лицо — ничего не происходит, идёт какая-то задержка". Over music or over the
 * assistant's own voice the recogniser never hears silence and never
 * finalises; commands acted on only from final transcripts waited for quiet.
 */

describe("commands that may run from a partial result", () => {
  it("include the ones he says over music", () => {
    for (const said of ["пауза", "поставь на паузу", "сделай тише", "сделай громче", "дальше", "продолжи"]) {
      expect(canActOnPartial(matchIntent(said)), said).toBe(true);
    }
  });

  it("include opening a card and the face", () => {
    for (const said of ["открой погоду", "покажи проекты", "покажи лицо", "убери лицо", "закрой"]) {
      expect(canActOnPartial(matchIntent(said)), said).toBe(true);
    }
  });

  it("never include playing something, which waits for the whole title", () => {
    // "включи океан" is the first word of "включи Океан Ельзи": acting on the
    // partial would start the wrong song.
    for (const said of ["включи океан", "включи", "поставь трек", "найди рецепт"]) {
      expect(canActOnPartial(matchIntent(said)), said).toBe(false);
    }
  });

  it("never include a question", () => {
    expect(canActOnPartial(matchIntent("что ты умеешь"))).toBe(false);
    expect(canActOnPartial(null)).toBe(false);
  });
});

describe("a command heard over the assistant's own voice", () => {
  // What it was saying, and what the microphone heard: its words, then his.
  const SAYING = "Сейчас в Аланье двадцать семь градусов, пасмурно и почти без ветра.";

  it("is found at the end of what was heard", () => {
    expect(commandAtEnd("сейчас в аланье двадцать семь убери лицо")).toBe("убери лицо");
    expect(commandAtEnd("пасмурно и почти без ветра пауза")).toBe("пауза");
    // "тише" alone already means the same thing, so that is what is kept.
    expect(commandAtEnd("двадцать семь градусов сделай тише")).toBe("тише");
    expect(commandAtEnd("почти без ветра закрой")).toBe("закрой");
  });

  it("and is not the assistant's own words", () => {
    for (const heard of ["убери лицо", "пауза", "сделай тише", "закрой"]) {
      expect(isTailOfSpeech(heard, SAYING), heard).toBe(false);
    }
  });

  it("is not found where there is none", () => {
    expect(commandAtEnd("сейчас в аланье двадцать семь градусов")).toBeNull();
    // A song title is never acted on half-said, over its voice either.
    expect(commandAtEnd("почти без ветра включи океан")).toBeNull();
  });

  it("is ignored when the assistant itself said it — the direction that must not break", () => {
    // Its own hint coming back through the microphone must not pause the music.
    const hint = "Чтобы остановить музыку, скажите пауза.";
    const heard = commandAtEnd("чтобы остановить музыку скажите пауза");
    expect(heard).toBe("пауза");
    expect(isTailOfSpeech(heard ?? "", hint)).toBe(true);
  });
});

describe("the same command arriving twice", () => {
  const louder = matchIntent("сделай громче")!;
  const ran = { key: intentKey(louder), at: 10_000 };

  it("is recognised when the final transcript follows the partial", () => {
    // Otherwise the volume would go up two notches for one "громче".
    expect(isRepeatOf(ran, matchIntent("Сделай громче."), 10_900)).toBe(true);
  });

  it("is recognised when the partial grew into other words for the same thing", () => {
    expect(isRepeatOf(ran, matchIntent("громче"), 10_500)).toBe(true);
  });

  it("is a new command when said again later", () => {
    expect(isRepeatOf(ran, louder, 10_000 + REPEAT_MS + 1)).toBe(false);
  });

  it("is a new command when it is a different one", () => {
    expect(isRepeatOf(ran, matchIntent("сделай тише"), 10_500)).toBe(false);
    expect(isRepeatOf(null, louder, 10_500)).toBe(false);
    expect(isRepeatOf(ran, null, 10_500)).toBe(false);
  });
});
