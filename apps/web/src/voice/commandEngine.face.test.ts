import { describe, expect, it } from "vitest";
import { matchIntent } from "./commandEngine";

/**
 * "Закрой лицо" did nothing: the hide verbs did not include it, so the phrase
 * fell through to the generic close verb and collapsed a panel instead.
 */
describe("hiding the face", () => {
  it("accepts every natural way of asking it to go", () => {
    for (const said of [
      "скрой лицо",
      "закрой лицо",
      "убери лицо",
      "выключи лицо",
      "спрячь себя",
      "hide your face",
    ]) {
      expect(matchIntent(said), said).toMatchObject({ kind: "showFace", show: false });
    }
  });

  it("still shows it", () => {
    expect(matchIntent("покажи своё лицо")).toMatchObject({ kind: "showFace", show: true });
    expect(matchIntent("тор покажи лицо")).toMatchObject({ kind: "showFace", show: true });
  });

  it("does not mistake a bare close for a face command", () => {
    expect(matchIntent("закрой")).toMatchObject({ kind: "close" });
  });
});
