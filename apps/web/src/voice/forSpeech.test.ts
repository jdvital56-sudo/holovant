import { describe, expect, it } from "vitest";
import { forSpeech, forVoice } from "./speechText";

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
    expect(forVoice("₴42")).toBe("42 гривны");
    expect(forVoice("42 ₴")).toBe("42 гривны");
    expect(forVoice("рост 3%")).toBe("рост 3 процента");
    expect(forVoice("сейчас 22°C")).toBe("сейчас 22 градуса");
  });

  /** The sentences the assistant actually produced when he asked. */
  it("speaks the answers he was given", () => {
    expect(forVoice("Курс доллара к гривне сейчас 41,25 гривны за доллар.")).toBe(
      "Курс доллара к гривне сейчас 41 и 25 гривны за доллар.",
    );
    expect(forVoice("Биткоин торгуется около $80,270, за сутки вырос на 1.5%.")).toBe(
      "Биткоин торгуется около 80270 долларов, за сутки вырос на 1 и 5 процента.",
    );
    expect(forVoice("Сейчас в Киеве 22°C, ощущается как 20°C.")).toBe(
      "Сейчас в Киеве 22 градуса, ощущается как 20 градусов.",
    );
    expect(forVoice("€1 = 45,30 ₴")).toBe("1 евро = 45 и 30 гривны");
  });

  it("leaves ordinary sentences alone", () => {
    expect(forVoice("Открываю Instagram")).toBe("Открываю Instagram");
    expect(forVoice("Сегодня 28 августа")).toBe("Сегодня двадцать восьмого августа");
  });

  it("still strips markdown", () => {
    expect(forVoice("**курс** 44.48")).toBe("курс 44 и 48");
  });
});

/**
 * Slashes and signs are shorthand on a screen and the name of a mark out loud.
 * These strings are ones the System and Weather modules actually speak.
 */
describe("forVoice — signs the synthesiser would name", () => {
  it("says units, not the slash", () => {
    expect(forVoice("ветер 8 км/ч")).toBe("ветер 8 километров в час");
    expect(forVoice("Сеть 4g, 10 Мбит/с")).toBe("Сеть 4g, 10 мегабит в секунду");
  });

  it("says a screen size as a dimension", () => {
    expect(forVoice("экран 1920×1080")).toBe("экран 1920 на 1080");
  });

  it("resolves a bare slash rather than naming it", () => {
    expect(forVoice("чёрный/белый")).toBe("чёрный или белый");
    expect(forVoice("работаем 24/7")).toBe("работаем круглосуточно");
  });

  it("says an ampersand as a word", () => {
    expect(forVoice("Tom & Jerry")).toBe("Tom и Jerry");
  });

  it("does not read a web address aloud", () => {
    expect(forVoice("подробности на https://example.com/page тут")).toBe("подробности на тут");
  });

  it("leaves text without signs alone", () => {
    expect(forVoice("Открываю Instagram")).toBe("Открываю Instagram");
  });
});

/**
 * "44,57 грн" was read out as "грны". A synthesiser cannot guess a short form,
 * and this is the class of problem, not one instance of it.
 */
describe("forVoice — abbreviations said in full", () => {
  it("says currency short forms as words", () => {
    expect(forVoice("Курс НБУ — 44,57 грн за доллар")).toBe(
      "Курс НБУ, 44 и 57 гривны за доллар",
    );
    expect(forVoice("оборот 12 млн руб. в год")).toBe("оборот 12 миллионов рублей в год");
    expect(forVoice("50 тыс. клиентов")).toBe("50 тысяч клиентов");
  });

  it("says hardware shorthand the System module speaks", () => {
    expect(forVoice("8 ядер · 16 GB RAM")).toBe("8 ядер · 16 гигабайт оперативной памяти");
    expect(forVoice("20 fps, экран 1920×1080")).toBe(
      "20 кадров в секунду, экран 1920 на 1080",
    );
  });

  it("expands a unit only when a figure precedes it", () => {
    expect(forVoice("до объекта 3 км")).toBe("до объекта 3 километра");
    // "см" on its own is as likely to be "смотри" as centimetres.
    expect(forVoice("см выше")).toBe("см выше");
    expect(forVoice("длина 7 см")).toBe("длина 7 сантиметров");
  });

  it("does not maul a word that merely starts with a short form", () => {
    expect(forVoice("смотри внимательно")).toBe("смотри внимательно");
    expect(forVoice("километровая очередь")).toBe("километровая очередь");
    expect(forVoice("минимум усилий")).toBe("минимум усилий");
  });

  it("still handles the slash units first", () => {
    expect(forVoice("ветер 8 км/ч")).toBe("ветер 8 километров в час");
    expect(forVoice("Сеть 4g, 10 Мбит/с")).toBe("Сеть 4g, 10 мегабит в секунду");
  });
});

describe("forVoice — a range is said with words", () => {
  it("reads a price range as from-to, not as a list", () => {
    expect(forVoice("покупают за 44,30–44,40 грн")).toBe(
      "покупают за от 44 и 30 до 44 и 40 гривны",
    );
    expect(forVoice("сегодня от 12–22 градусов")).toBe(
      "сегодня от двенадцати до двадцати двух градусов",
    );
  });

  it("leaves a dash between words as a pause", () => {
    expect(forVoice("Курс НБУ — 44,57 грн")).toBe("Курс НБУ, 44 и 57 гривны");
  });
});
