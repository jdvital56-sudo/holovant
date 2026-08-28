import { describe, expect, it } from "vitest";
import { matchIntent } from "./commandEngine";

/**
 * Every line here is something the founder reported as not working, written
 * the way he said it. He has twice been told a thing was fixed when it was
 * not; these are so that claim can be checked rather than trusted.
 */
describe("reported broken — switching modules while music plays", () => {
  it("opens a module instead of hunting for a track by that name", () => {
    // This went to YouTube, played a video about Instagram, and never opened
    // the module — which from across the room is no reaction at all.
    expect(matchIntent("включи Instagram")).toMatchObject({
      kind: "open",
      moduleId: "instagram",
    });
    expect(matchIntent("переключись на инстаграм")).toMatchObject({
      kind: "open",
      moduleId: "instagram",
    });
    expect(matchIntent("включи погоду")).toMatchObject({ kind: "open", moduleId: "weather" });
    expect(matchIntent("поставь новости")).toMatchObject({ kind: "open", moduleId: "news" });
  });

  it("still plays a track that merely sounds like a name", () => {
    expect(matchIntent("включи Radiohead")).toMatchObject({ kind: "play", query: "radiohead" });
    expect(matchIntent("включи музыку")).toMatchObject({ kind: "play", query: "" });
  });
});

describe("reported broken — the saved collection", () => {
  it("finds the favourites however he phrases it", () => {
    for (const said of [
      "включи мою любимую музыку",
      "моя любимая музыка",
      "включи мои любимые треки",
      "поставь мою музыку",
      "включи избранное",
      "play my favourite music",
    ]) {
      expect(matchIntent(said), said).toMatchObject({ kind: "favoritePlay" });
    }
  });

  it("still saves what is playing", () => {
    expect(matchIntent("запомни этот трек")).toMatchObject({ kind: "favoriteAdd" });
    expect(matchIntent("сохрани в избранное")).toMatchObject({ kind: "favoriteAdd" });
  });
});

describe("reported broken — transport control", () => {
  it("pauses and resumes rather than closing the player", () => {
    expect(matchIntent("пауза")).toMatchObject({ kind: "pause" });
    expect(matchIntent("поставь на паузу")).toMatchObject({ kind: "pause" });
    expect(matchIntent("продолжай")).toMatchObject({ kind: "resume" });
    expect(matchIntent("включи дальше")).toMatchObject({ kind: "resume" });
    expect(matchIntent("следующий трек")).toMatchObject({ kind: "next" });
  });
});

describe("reported broken — volume", () => {
  it("hears it however he says it", () => {
    for (const said of ["громче", "сделай громче", "погромче", "прибавь звук"]) {
      expect(matchIntent(said), said).toMatchObject({ kind: "volume", direction: "up" });
    }
    for (const said of ["тише", "сделай тише", "потише", "убавь звук"]) {
      expect(matchIntent(said), said).toMatchObject({ kind: "volume", direction: "down" });
    }
  });
});

describe("the assistant answers to its new name", () => {
  it("wakes on Thor", () => {
    expect(matchIntent("Тор")).toMatchObject({ kind: "wake" });
    expect(matchIntent("thor")).toMatchObject({ kind: "wake" });
    expect(matchIntent("тхор")).toMatchObject({ kind: "wake" });
  });

  it("takes a command with the name in front", () => {
    expect(matchIntent("тор включи инстаграм")).toMatchObject({ kind: "open" });
    expect(matchIntent("тор сделай громче")).toMatchObject({ kind: "volume" });
  });
});
