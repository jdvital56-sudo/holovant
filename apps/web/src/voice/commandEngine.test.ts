import { describe, it, expect } from "vitest";
import { matchIntent } from "./commandEngine";

describe("matchIntent — opening modules", () => {
  it("opens a module from an explicit English command", () => {
    expect(matchIntent("open Instagram")).toMatchObject({ kind: "open", moduleId: "instagram" });
  });

  it("opens a module from an explicit Russian command", () => {
    expect(matchIntent("открой инстаграм")).toMatchObject({ kind: "open", moduleId: "instagram" });
  });

  it("treats a bare module name as a request to open it", () => {
    expect(matchIntent("Stocks")).toMatchObject({ kind: "open", moduleId: "stocks" });
  });

  it("accepts the spellings a recogniser actually produces for brand names", () => {
    expect(matchIntent("покажи тик ток")).toMatchObject({ kind: "open", moduleId: "tiktok" });
    expect(matchIntent("show you tube")).toMatchObject({ kind: "open", moduleId: "youtube" });
  });
});

describe("matchIntent — rotation", () => {
  it("rotates on a verb plus direction", () => {
    expect(matchIntent("rotate left")).toMatchObject({ kind: "rotate", direction: "left" });
    expect(matchIntent("поверни направо")).toMatchObject({ kind: "rotate", direction: "right" });
  });

  it("rotates on a bare direction, since that is how people speak", () => {
    expect(matchIntent("влево")).toMatchObject({ kind: "rotate", direction: "left" });
  });

  it("ignores a phrase naming both directions, which is not a direction", () => {
    expect(matchIntent("left or right")).toBeNull();
  });
});

describe("matchIntent — closing", () => {
  it("closes on either language", () => {
    expect(matchIntent("close")).toMatchObject({ kind: "close" });
    expect(matchIntent("закрой")).toMatchObject({ kind: "close" });
  });
});

describe("matchIntent — refusing to guess", () => {
  it("returns null for speech that is not a command", () => {
    expect(matchIntent("what time is the meeting tomorrow")).toBeNull();
    expect(matchIntent("")).toBeNull();
  });

  it("does not open a module merely mentioned inside a longer sentence", () => {
    // Moving the interface under the user because a word appeared in passing
    // is worse than doing nothing.
    expect(matchIntent("I was reading about Instagram advertising costs today")).toBeNull();
  });
});
