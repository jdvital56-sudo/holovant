import { describe, expect, it } from "vitest";
import { pluralRu, dayOrdinal, yearOrdinal } from "./russianNumbers";

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
