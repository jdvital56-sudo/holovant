import { describe, expect, it } from "vitest";
import { matchIntent } from "./commandEngine";

/**
 * He asked for named collections — one for work, one to relax to — rather than
 * a single pile called "favourites", and for the assistant to know which is
 * which when he says it out loud.
 */
describe("naming a collection out loud", () => {
  it("saves into a named collection", () => {
    expect(matchIntent("сохрани в подборку для работы")).toMatchObject({
      kind: "favoriteAdd",
      playlist: "для работы",
    });
    expect(matchIntent("добавь в плейлист для релакса")).toMatchObject({
      kind: "favoriteAdd",
      playlist: "для релакса",
    });
    expect(matchIntent("запомни этот трек в сборник вечерний")).toMatchObject({
      kind: "favoriteAdd",
      playlist: "вечерний",
    });
  });

  it("saves with no collection named, which is the default one", () => {
    expect(matchIntent("запомни этот трек")).toMatchObject({
      kind: "favoriteAdd",
      playlist: null,
    });
  });

  it("plays a named collection", () => {
    expect(matchIntent("включи подборку для работы")).toMatchObject({
      kind: "favoritePlay",
      playlist: "для работы",
    });
    expect(matchIntent("поставь плейлист для настроения")).toMatchObject({
      kind: "favoritePlay",
      playlist: "для настроения",
    });
  });

  it("plays the default collection when none is named", () => {
    expect(matchIntent("включи избранное")).toMatchObject({
      kind: "favoritePlay",
      playlist: null,
    });
    expect(matchIntent("включи мою любимую музыку")).toMatchObject({
      kind: "favoritePlay",
      playlist: null,
    });
  });

  it("answers a question about the collections rather than playing one", () => {
    expect(matchIntent("какие у меня подборки")).toMatchObject({ kind: "playlistList" });
    expect(matchIntent("перечисли мои плейлисты")).toMatchObject({ kind: "playlistList" });
  });
});
