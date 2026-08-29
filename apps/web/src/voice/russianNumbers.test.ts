import { describe, expect, it } from "vitest";
import { pluralRu, dayOrdinal, yearOrdinal, genitiveCardinal } from "./russianNumbers";

/**
 * "22 градусов" and "28 августа 2026" are what a synthesiser says when nobody
 * has told it how Russian agrees. The founder heard it as a toy rather than a
 * product, and he is right.
 */
describe("agreement after a numeral", () => {
  const degrees: [string, string, string] = ["градус", "градуса", "градусов"];

  it("takes the singular after one", () => {
    expect(pluralRu(1, degrees)).toBe("градус");
    expect(pluralRu(21, degrees)).toBe("градус");
    expect(pluralRu(101, degrees)).toBe("градус");
  });

  it("takes the second form after two to four", () => {
    expect(pluralRu(2, degrees)).toBe("градуса");
    expect(pluralRu(3, degrees)).toBe("градуса");
    expect(pluralRu(22, degrees)).toBe("градуса");
    expect(pluralRu(44, degrees)).toBe("градуса");
  });

  it("takes the third form after five and above", () => {
    expect(pluralRu(5, degrees)).toBe("градусов");
    expect(pluralRu(20, degrees)).toBe("градусов");
    expect(pluralRu(100, degrees)).toBe("градусов");
  });

  it("treats the teens as an exception, as Russian does", () => {
    expect(pluralRu(11, degrees)).toBe("градусов");
    expect(pluralRu(12, degrees)).toBe("градусов");
    expect(pluralRu(14, degrees)).toBe("градусов");
    expect(pluralRu(111, degrees)).toBe("градусов");
  });

  it("treats a fraction as two-to-four", () => {
    expect(pluralRu(1.5, degrees)).toBe("градуса");
    expect(pluralRu(44.57, degrees)).toBe("градуса");
  });
});

describe("dates as they are said aloud", () => {
  it("gives the day as an ordinal", () => {
    expect(dayOrdinal(1)).toBe("первого");
    expect(dayOrdinal(3)).toBe("третьего");
    expect(dayOrdinal(8)).toBe("восьмого");
    expect(dayOrdinal(20)).toBe("двадцатого");
    expect(dayOrdinal(28)).toBe("двадцать восьмого");
    expect(dayOrdinal(31)).toBe("тридцать первого");
  });

  it("gives the year as an ordinal, in the case the sentence needs", () => {
    expect(yearOrdinal(2026)).toBe("две тысячи двадцать шестого");
    expect(yearOrdinal(2026, "nominative")).toBe("две тысячи двадцать шестой");
    expect(yearOrdinal(2026, "prepositional")).toBe("две тысячи двадцать шестом");
    expect(yearOrdinal(2020)).toBe("две тысячи двадцатого");
    expect(yearOrdinal(2000)).toBe("двухтысячного");
    expect(yearOrdinal(1999)).toBe("тысяча девятьсот девяносто девятого");
  });
});

/**
 * "Сегодня от 12 до 26 градусов" came out as "от двенадцать до двадцать шесть
 * градусов". The noun was already right; the number in front of it was not.
 * A preposition puts the figure in its case too, and a synthesiser reads every
 * figure in the nominative.
 */
describe("a number after a preposition", () => {
  it("gives the plain numbers", () => {
    expect(genitiveCardinal(1)).toBe("одного");
    expect(genitiveCardinal(5)).toBe("пяти");
    expect(genitiveCardinal(12)).toBe("двенадцати");
    expect(genitiveCardinal(20)).toBe("двадцати");
    expect(genitiveCardinal(40)).toBe("сорока");
    expect(genitiveCardinal(90)).toBe("девяноста");
  });

  it("builds a compound from its parts", () => {
    expect(genitiveCardinal(26)).toBe("двадцати шести");
    expect(genitiveCardinal(44)).toBe("сорока четырёх");
    expect(genitiveCardinal(101)).toBe("ста одного");
    expect(genitiveCardinal(365)).toBe("трёхсот шестидесяти пяти");
  });

  it("says nothing rather than guessing beyond what it covers", () => {
    expect(genitiveCardinal(1000)).toBeNull();
    expect(genitiveCardinal(1.5)).toBeNull();
    expect(genitiveCardinal(-4)).toBeNull();
  });
});
