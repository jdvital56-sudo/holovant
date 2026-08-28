import { describe, expect, it } from "vitest";
import { forSpeech, forVoice } from "./speech";

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

/**
 * The founder heard "сорок четыре точка сорок восемь" and "знак доллара".
 * Separators and symbols are punctuation to the synthesiser and quantity to
 * the listener.
 */
describe("forVoice — numbers said as a person says them", () => {
  it("does not read the decimal separator as a word", () => {
    expect(forVoice("курс 44.48")).toBe("курс 44 и 48");
    expect(forVoice("выросла на 1,5")).toBe("выросла на 1 и 5");
  });

  it("keeps a grouped number as one quantity", () => {
    expect(forVoice("биткоин $80,270")).toBe("биткоин 80270 долларов");
    expect(forVoice("около 1,250,000 человек")).toBe("около 1250000 человек");
  });

  it("says currency and units by name, symbol before or after", () => {
    expect(forVoice("$100")).toBe("100 долларов");
    expect(forVoice("€50")).toBe("50 евро");
    expect(forVoice("₴42")).toBe("42 гривен");
    expect(forVoice("42 ₴")).toBe("42 гривен");
    expect(forVoice("рост 3%")).toBe("рост 3 процентов");
    expect(forVoice("сейчас 22°C")).toBe("сейчас 22 градусов");
  });

  /** The sentences the assistant actually produced when he asked. */
  it("speaks the answers he was given", () => {
    expect(forVoice("Курс доллара к гривне сейчас 41,25 гривны за доллар.")).toBe(
      "Курс доллара к гривне сейчас 41 и 25 гривны за доллар.",
    );
    expect(forVoice("Биткоин торгуется около $80,270, за сутки вырос на 1.5%.")).toBe(
      "Биткоин торгуется около 80270 долларов, за сутки вырос на 1 и 5 процентов.",
    );
    expect(forVoice("Сейчас в Киеве 22°C, ощущается как 20°C.")).toBe(
      "Сейчас в Киеве 22 градусов, ощущается как 20 градусов.",
    );
    expect(forVoice("€1 = 45,30 ₴")).toBe("1 евро = 45 и 30 гривен");
  });

  it("leaves ordinary sentences alone", () => {
    expect(forVoice("Открываю Instagram")).toBe("Открываю Instagram");
    expect(forVoice("Сегодня 28 августа")).toBe("Сегодня 28 августа");
  });

  it("still strips markdown", () => {
    expect(forVoice("**курс** 44.48")).toBe("курс 44 и 48");
  });
});
