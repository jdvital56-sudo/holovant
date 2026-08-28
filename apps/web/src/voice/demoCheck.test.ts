import { describe, expect, it } from "vitest";
import { forVoice } from "./speechText";

/**
 * The exact answers the assistant produced during testing, run through the
 * voice pipeline. Written before recording a demonstration: what is checked
 * here is what will actually be heard.
 */
const SPOKEN = [
  "По состоянию на сегодня, 28 августа, курс НБУ — около 44,57 грн за доллар. В банках доллар покупают примерно за 44,30–44,40, продают около 44,90–44,92 грн.",
  "Биткоин сейчас торгуется около $80 270. За сутки он вырос примерно на 1,5%.",
  "В Киеве сейчас 18 градусов, почти ясно, ветер 8 км/ч. Сегодня от 12 до 22 градусов.",
  "Видео: Intel UHD Graphics · 8 ядер · 16 GB RAM. 20 fps, качество high, экран 1920×1080. Сеть 4g, 10 Мбит/с.",
  "Оборот вырос на 12 млн руб., это порядка 50 тыс. клиентов и т.д.",
];

describe("what the demonstration will actually sound like", () => {
  it("leaves no mark, sign or short form for the voice to name", () => {
    for (const line of SPOKEN) {
      const said = forVoice(line);
      // Anything here would be pronounced as the name of the character.
      expect(said, line).not.toMatch(/[*_`#|~/\×$€₴£%°&]/);
      // Short forms a Russian voice reads as letters.
      expect(said, line).not.toMatch(/(^|\s)(грн|руб|тыс|млн|млрд|GB|MB|RAM|fps)\.?(\s|$)/i);
      // A decimal separator between digits is read as "точка"/"запятая".
      expect(said, line).not.toMatch(/\d[.,]\d/);
    }
  });

  it("keeps the numbers themselves intact", () => {
    expect(forVoice(SPOKEN[0])).toContain("44 и 57 гривны");
    expect(forVoice(SPOKEN[1])).toContain("80270 долларов");
    expect(forVoice(SPOKEN[2])).toContain("8 километров в час");
    expect(forVoice(SPOKEN[3])).toContain("1920 на 1080");
    expect(forVoice(SPOKEN[4])).toContain("12 миллионов рублей");
  });
});

/**
 * "Сейчас 22, пятница, 26 год" is what he heard when he asked the time in
 * Turkey. Russian agreement is the difference between a product and a toy,
 * and he said so in those words.
 */
describe("endings, as a Russian speaker expects them", () => {
  it("says a date the way a person says it", () => {
    expect(forVoice("Сегодня пятница, 28 августа 2026 года.")).toBe(
      "Сегодня пятница, двадцать восьмого августа две тысячи двадцать шестого года.",
    );
    expect(forVoice("Это было в 2020 году")).toBe("Это было в две тысячи двадцатом году");
    expect(forVoice("Наступил 2026 год")).toBe("Наступил две тысячи двадцать шестой год");
    expect(forVoice("Дата 28.08.2026")).toBe(
      "Дата двадцать восьмого августа две тысячи двадцать шестого года",
    );
  });

  it("says a clock time as hours and minutes", () => {
    expect(forVoice("Сейчас 22:08")).toBe("Сейчас 22 часа 8 минут");
    expect(forVoice("в 21:01")).toBe("в 21 час 1 минута");
    expect(forVoice("ровно 15:00")).toBe("ровно 15 часов ровно");
  });

  it("agrees the unit with its number", () => {
    expect(forVoice("1 градус")).toBe("1 градус");
    expect(forVoice("сейчас 22°C")).toBe("сейчас 22 градуса");
    expect(forVoice("сейчас 15°C")).toBe("сейчас 15 градусов");
    expect(forVoice("$1")).toBe("1 доллар");
    expect(forVoice("$2")).toBe("2 доллара");
    expect(forVoice("$11")).toBe("11 долларов");
    expect(forVoice("21 млн")).toBe("21 миллион");
    expect(forVoice("22 млн")).toBe("22 миллиона");
    expect(forVoice("25 млн")).toBe("25 миллионов");
  });
});
