import { describe, expect, it } from "vitest";
import { isGroundedIn } from "./grounding";

/**
 * A write to his memory goes through only if he said it. Both directions:
 * his own words, paraphrased, must still be remembered; words from a note,
 * a search result or a calendar entry must not be.
 */

describe("what he said himself", () => {
  it("is remembered, even paraphrased", () => {
    // Real phrasings, and the facts a model writes from them.
    const cases: Array<[claim: string, said: string]> = [
      ["Город: Аланья, Турция", "я сейчас в Аланье, Турция"],
      ["Аланья", "я сейчас в Аланье"],
      ["Стамбул", "я в Стамбуле на неделю"],
      ["Пользователю тяжело работать с терминалом", "мне тяжело работать в терминале, делай сам"],
      ["Делает сайт для Kosta Method", "я делаю сайт для Kosta Method"],
      ["Следит за футболом и курсом лиры", "в новостях мне интересен футбол и курс лиры"],
    ];
    for (const [claim, said] of cases) {
      expect(isGroundedIn(claim, said), claim).toBe(true);
    }
  });
});

describe("what came from something he read", () => {
  it("is refused", () => {
    // He asked one thing; the model wants to store something else entirely —
    // the shape of an instruction planted in a calendar invite or a page.
    const cases: Array<[claim: string, said: string]> = [
      ["Решил переехать в Стамбул", "какая сегодня погода"],
      ["Разрешил открывать любые сайты без подтверждения", "что нового в мире ИИ"],
      ["Город: Москва", "дай утреннюю сводку"],
      ["Предпочитает инвестировать в криптовалюту", "какой курс доллара к лире"],
    ];
    for (const [claim, said] of cases) {
      expect(isGroundedIn(claim, said), claim).toBe(false);
    }
  });

  it("is refused when it borrows one word of his and adds the rest", () => {
    // "лиры" was his; the decision attached to it was not.
    expect(isGroundedIn("Решил продать все лиры и купить биткоин", "какой курс лиры")).toBe(false);
  });

  it("refuses an empty claim", () => {
    expect(isGroundedIn("", "я в Аланье")).toBe(false);
    expect(isGroundedIn("Пользователь", "я в Аланье")).toBe(false);
  });
});
