import { describe, expect, it } from "vitest";
import { matchIntent } from "./commandEngine";

describe("wake word", () => {
  it("treats the bare name as a call for attention", () => {
    expect(matchIntent("Вита")).toMatchObject({ kind: "wake" });
    expect(matchIntent("вита ты тут")).toMatchObject({ kind: "wake" });
  });

  it("lets the name in front of a command fall through to the command", () => {
    expect(matchIntent("вита покажи своё лицо")).toMatchObject({ kind: "showFace", show: true });
    expect(matchIntent("вита включи музыку")).toMatchObject({ kind: "play" });
  });
});

describe("volume", () => {
  it("hears louder and quieter, with or without a verb", () => {
    expect(matchIntent("громче")).toMatchObject({ kind: "volume", direction: "up" });
    expect(matchIntent("сделай громче")).toMatchObject({ kind: "volume", direction: "up" });
    expect(matchIntent("сделай тише")).toMatchObject({ kind: "volume", direction: "down" });
    expect(matchIntent("потише")).toMatchObject({ kind: "volume", direction: "down" });
  });
});

describe("dismiss", () => {
  it("clears the chat", () => {
    expect(matchIntent("убери чат")).toMatchObject({ kind: "dismiss", target: "chat" });
    expect(matchIntent("закрой ответ")).toMatchObject({ kind: "dismiss", target: "chat" });
  });

  it("clears the player", () => {
    expect(matchIntent("убери плеер")).toMatchObject({ kind: "dismiss", target: "player" });
    expect(matchIntent("выключи музыку")).toMatchObject({ kind: "dismiss", target: "player" });
  });

  it("clears everything", () => {
    expect(matchIntent("убери всё")).toMatchObject({ kind: "dismiss", target: "all" });
  });
});
