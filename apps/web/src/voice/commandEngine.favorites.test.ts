import { describe, expect, it } from "vitest";
import { matchIntent } from "./commandEngine";

/**
 * The founder asked for his own saved tracks, played back without a search or
 * the video player each time. "Мою музыку" must reach that collection, not the
 * default stream that a bare "музыку" plays.
 */
describe("favorite tracks by voice", () => {
  it("saves whatever is playing", () => {
    expect(matchIntent("запомни этот трек")).toMatchObject({ kind: "favoriteAdd" });
    expect(matchIntent("добавь в избранное")).toMatchObject({ kind: "favoriteAdd" });
    expect(matchIntent("сохрани песню")).toMatchObject({ kind: "favoriteAdd" });
  });

  it("plays the saved collection back", () => {
    expect(matchIntent("включи избранное")).toMatchObject({ kind: "favoritePlay" });
    expect(matchIntent("включи мою музыку")).toMatchObject({ kind: "favoritePlay" });
    expect(matchIntent("поставь мой сборник")).toMatchObject({ kind: "favoritePlay" });
    expect(matchIntent("play my favorites")).toMatchObject({ kind: "favoritePlay" });
  });

  it("does not send 'мою музыку' to the default stream", () => {
    expect(matchIntent("включи мою музыку")).not.toMatchObject({ kind: "play" });
  });

  it("leaves a bare music request on the default stream", () => {
    expect(matchIntent("включи музыку")).toMatchObject({ kind: "play", query: "" });
  });

  it("leaves a named track alone", () => {
    expect(matchIntent("включи музыку Radiohead")).toMatchObject({
      kind: "play",
      query: "radiohead",
    });
  });

  it("does not treat a removal as a request to play", () => {
    expect(matchIntent("убери из избранного")).toBeNull();
  });
});
