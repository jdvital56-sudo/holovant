import { describe, expect, it } from "vitest";
import { forVoice } from "./speechText";

/**
 * Stress, for the handful of words espeak reads with the accent in the wrong
 * place.
 *
 * He reported it as "ударение на первое «о», а он говорит на второе «о»", and
 * rather than guess which word that was, every numeral, ordinal, month, unit
 * and card label the product can say was run through espeak's phonemiser and
 * the stressed syllable read off in text. Out of about a hundred and thirty
 * words, two are wrong — and they are both "forty".
 *
 * The third form is the reason this is a table of exact words and not a prefix
 * rule: "сороковой" is already correct, and a rule broad enough to catch
 * "сорок" would break it.
 */

/**
 * espeak's own mark: combining acute, placed after the stressed vowel. Written
 * as an escape on purpose — the character itself is invisible in an editor,
 * and a test nobody can read is a test nobody can correct.
 */
const ACUTE = "\u0301";

describe("stress", () => {
  it("puts the accent on the first syllable of сорок", () => {
    // Measured: plain "сорок" phonemises to sʌrˈok — "сорОк". With the acute
    // it becomes sˈorʌk, which is the word.
    expect(forVoice("сорок восемь лир")).toBe(`со${ACUTE}рок восемь лир`);
  });

  it("puts the accent on the last syllable of сорока", () => {
    // The genitive of the numeral is "сорокá". espeak says "соро́ка", which is
    // the bird. Both are real words, which is why it sounds confident.
    expect(forVoice("от сорока до пятидесяти")).toBe(
      `от сорока${ACUTE} до пятидесяти`,
    );
  });

  it("leaves the ordinal alone, which espeak already reads correctly", () => {
    // The direction that a prefix rule would have broken. Measured:
    // "сороковой" is sʌrʌkʌvˈoj, which is right.
    for (const said of [
      "сороковой год",
      "тысяча девятьсот сорокового года",
      "в сороковом году",
      "сороковое место",
    ]) {
      expect(forVoice(said), said).toBe(said);
    }
  });

  it("keeps the capital letter when the sentence starts with the word", () => {
    // The rates line begins with it, so the common case is capitalised.
    expect(forVoice("Сорок восемь лир за доллар.")).toBe(
      `Со${ACUTE}рок восемь лир за доллар.`,
    );
  });

  it("does not touch a figure, which espeak reads correctly on its own", () => {
    // Measured: "48" phonemises to sˈorʌk — the number reader gets it right,
    // and only our own spelled-out words are wrong. Marking digits would be
    // marking something that is not broken.
    expect(forVoice("48 лир")).toBe("48 лир");
    expect(forVoice("40")).toBe("40");
  });

  it("does not find the word inside a longer one", () => {
    // Real words that begin with it, rather than invented ones: the rule has
    // to stop at the edge of the word and nowhere earlier.
    for (const said of ["сорокалетие", "сорокапятка", "сороконожка"]) {
      expect(forVoice(said), said).toBe(said);
    }
  });

  it("marks the word wherever it appears in a sentence", () => {
    expect(forVoice("Осталось сорок минут")).toBe(`Осталось со${ACUTE}рок минут`);
    expect(forVoice("К сорока годам")).toBe(`К сорока${ACUTE} годам`);
  });

  it("leaves English alone", () => {
    expect(forVoice("forty lira", "en")).toBe("forty lira");
  });
});
