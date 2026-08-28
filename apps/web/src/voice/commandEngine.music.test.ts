import { describe, expect, it } from "vitest";
import { matchIntent } from "./commandEngine";

/**
 * What the founder actually said out loud, rather than what the phrasing was
 * designed around. These were reported as "it finds it but nothing plays".
 */
describe("asking for music by voice", () => {
  it("recognises a request to play something", () => {
    expect(matchIntent("включи музыку Radiohead")).toMatchObject({ kind: "play" });
    expect(matchIntent("воспроизведи песню Bohemian Rhapsody")).toMatchObject({ kind: "play" });
    expect(matchIntent("play Bohemian Rhapsody")).toMatchObject({ kind: "play" });
  });

  it("carries the title, not the verb", () => {
    // Lower-cased along with the rest of the transcript; search does not care.
    expect(matchIntent("включи Radiohead Creep")).toMatchObject({
      kind: "play",
      query: "radiohead creep",
    });
  });

  it("plays a default stream when no title is given", () => {
    // "включи музыку" names no track — it still has to produce sound, so it
    // plays the default stream rather than silently opening a module.
    expect(matchIntent("включи музыку")).toMatchObject({ kind: "play", query: "" });
    expect(matchIntent("поставь музыку")).toMatchObject({ kind: "play", query: "" });
  });

  it("still opens the module on an open verb", () => {
    // "открой музыку" is not a request to play — it opens the module.
    expect(matchIntent("открой музыку")).toMatchObject({ kind: "open", moduleId: "music" });
  });
});

describe("Russian word endings", () => {
  it("matches a module whatever case it is spoken in", () => {
    // Commands are spoken in the accusative — "открой систему", not "система".
    // Matching whole words missed every one of these.
    expect(matchIntent("открой систему")).toMatchObject({ kind: "open", moduleId: "system" });
    expect(matchIntent("покажи погоду")).toMatchObject({ kind: "open", moduleId: "weather" });
    expect(matchIntent("открой музыку")).toMatchObject({ kind: "open", moduleId: "music" });
    expect(matchIntent("покажи новости")).toMatchObject({ kind: "open", moduleId: "news" });
    expect(matchIntent("открой биржу")).toMatchObject({ kind: "open", moduleId: "stocks" });
  });

  it("still matches the plain nominative", () => {
    expect(matchIntent("система")).toMatchObject({ kind: "open", moduleId: "system" });
    expect(matchIntent("погода")).toMatchObject({ kind: "open", moduleId: "weather" });
  });
});
