import { describe, expect, it } from "vitest";
import { encodeAction, extractActions, isSafeUrl } from "./actionTypes";

/**
 * Actions travel inside the answer stream, which arrives in arbitrary chunks.
 * An envelope split across two of them must not be acted on twice, dropped, or
 * read out to the user as text.
 */
describe("actions travelling in the stream", () => {
  it("comes back out the way it went in", () => {
    const encoded = encodeAction({ action: "open_module", args: { module: "instagram" } });
    const { text, actions, pending } = extractActions(`Открываю.${encoded} Готово.`);
    expect(text).toBe("Открываю. Готово.");
    expect(actions).toEqual([{ action: "open_module", args: { module: "instagram" } }]);
    expect(pending).toBe("");
  });

  it("never leaves a marker in what is shown or spoken", () => {
    const encoded = encodeAction({ action: "pause_music", args: {} });
    const { text } = extractActions(`Пауза.${encoded}`);
    expect(text).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
  });

  it("holds half an envelope back rather than acting on it", () => {
    const encoded = encodeAction({ action: "play_music", args: { query: "radiohead" } });
    const split = Math.floor(encoded.length / 2);

    const first = extractActions(`Включаю${encoded.slice(0, split)}`);
    expect(first.actions).toEqual([]);
    expect(first.text).toBe("Включаю");

    const second = extractActions(first.pending + encoded.slice(split) + " Готово.");
    expect(second.actions).toEqual([{ action: "play_music", args: { query: "radiohead" } }]);
    expect(second.text).toBe(" Готово.");
  });

  it("carries several actions in one chunk", () => {
    const chunk =
      encodeAction({ action: "hide_face", args: {} }) +
      "Открываю. " +
      encodeAction({ action: "open_module", args: { module: "weather" } });
    const { text, actions } = extractActions(chunk);
    expect(text).toBe("Открываю. ");
    expect(actions.map((a) => a.action)).toEqual(["hide_face", "open_module"]);
  });

  it("drops a malformed envelope instead of guessing", () => {
    const { text, actions } = extractActions(
      `до${String.fromCharCode(2)}не json${String.fromCharCode(3)}после`,
    );
    expect(actions).toEqual([]);
    expect(text).toBe("допосле");
  });
});

describe("only ordinary web addresses are opened", () => {
  it("accepts http and https", () => {
    expect(isSafeUrl("https://example.com/page")).toBe(true);
    expect(isSafeUrl("http://example.com")).toBe(true);
  });

  it("refuses anything that is not a web page", () => {
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeUrl("file:///C:/Users")).toBe(false);
    expect(isSafeUrl("data:text/html,<script>")).toBe(false);
    expect(isSafeUrl("not a url")).toBe(false);
  });
});
