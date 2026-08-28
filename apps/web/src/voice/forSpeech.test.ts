import { describe, expect, it } from "vitest";
import { forSpeech } from "./speech";

/**
 * The synthesiser reads punctuation by name — "звёздочка", "тире", "решётка".
 * The model answers in Markdown, so the marks have to come off before the
 * words are spoken.
 */
describe("forSpeech", () => {
  it("drops bold and italic marks", () => {
    expect(forSpeech("это **очень** важно")).toBe("это очень важно");
    expect(forSpeech("это *важно* здесь")).toBe("это важно здесь");
  });

  it("drops bullet and heading markers", () => {
    expect(forSpeech("- первый пункт")).toBe("первый пункт");
    expect(forSpeech("* второй пункт")).toBe("второй пункт");
    expect(forSpeech("### Заголовок")).toBe("Заголовок");
    expect(forSpeech("1. пункт списка")).toBe("пункт списка");
  });

  it("turns a dash aside into a pause, not the word 'тире'", () => {
    expect(forSpeech("Vita — твой помощник")).toBe("Vita, твой помощник");
    expect(forSpeech("план - это важно")).toBe("план, это важно");
  });

  it("collapses an ellipsis", () => {
    expect(forSpeech("подожди... сейчас")).toBe("подожди… сейчас");
  });

  it("strips inline code and links", () => {
    expect(forSpeech("открой `настройки` там")).toBe("открой настройки там");
    expect(forSpeech("см. [документацию](https://x.com) тут")).toBe("см. документацию тут");
  });

  it("leaves a plain confirmation untouched", () => {
    expect(forSpeech("Открываю Instagram")).toBe("Открываю Instagram");
    expect(forSpeech("Я здесь")).toBe("Я здесь");
  });
});
