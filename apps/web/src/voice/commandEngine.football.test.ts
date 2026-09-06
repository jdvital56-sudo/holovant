import { describe, expect, it } from "vitest";
import { matchIntent } from "./commandEngine";

/**
 * He asked for football, so he will say football.
 *
 * The card is called Sports in the ring and its only Russian alias was
 * "спорт" — a word he has not used once. The rows here are the phrasings he
 * actually uses for a card, taken from what he has said about the others.
 */
describe("opening the football card", () => {
  it("opens on the word he uses", () => {
    for (const said of [
      "открой футбол",
      "покажи футбол",
      "Тор, покажи футбол",
      // Russian inflects, and a command is spoken in the accusative.
      "открой футбольную таблицу",
    ]) {
      expect(matchIntent(said), said).toMatchObject({ kind: "open", moduleId: "sports" });
    }
  });

  it("still opens on the word it had before", () => {
    // The other direction: the alias that was already there must not have been
    // displaced by the new one.
    expect(matchIntent("открой спорт")).toMatchObject({ kind: "open", moduleId: "sports" });
    expect(matchIntent("show sports")).toMatchObject({ kind: "open", moduleId: "sports" });
  });

  it("does not take a football card over the cards it is not", () => {
    // A new alias is a new way to match the wrong module. These are the cards
    // he opens most.
    expect(matchIntent("открой погоду")).toMatchObject({ moduleId: "weather" });
    expect(matchIntent("покажи музыку")).toMatchObject({ moduleId: "music" });
    expect(matchIntent("открой календарь")).toMatchObject({ moduleId: "calendar" });
    expect(matchIntent("покажи проекты")).toMatchObject({ moduleId: "projects" });
  });
});
