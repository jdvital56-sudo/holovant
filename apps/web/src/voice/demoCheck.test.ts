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
    expect(forVoice(SPOKEN[0])).toContain("44 и 57 гривен");
    expect(forVoice(SPOKEN[1])).toContain("80270 долларов");
    expect(forVoice(SPOKEN[2])).toContain("8 километров в час");
    expect(forVoice(SPOKEN[3])).toContain("1920 на 1080");
    expect(forVoice(SPOKEN[4])).toContain("12 миллионов рублей");
  });
});
