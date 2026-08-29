/**
 * Russian agreement for anything said after a number.
 *
 * A synthesiser reads the digits and the word exactly as written, so "22
 * градусов" and "28 августа 2026" come out as "двадцать два градусов" and
 * "двадцать восемь августа две тысячи двадцать шесть". Both are wrong in a way
 * a Russian speaker hears immediately — it is the difference between a product
 * and a toy, which is the founder's point.
 */

/** The three forms a noun takes after a numeral. */
export type NounForms = [one: string, few: string, many: string];

/**
 * Picks the form for a count. One, two-to-four and the rest each take a
 * different case, except in the teens, where everything takes the last.
 */
export function pluralRu(n: number, forms: NounForms): string {
  // A fractional quantity takes the same form as two-to-four: "1,5 процента".
  if (!Number.isInteger(n)) return forms[1];

  const withinHundred = Math.abs(n) % 100;
  const lastDigit = withinHundred % 10;

  if (withinHundred >= 11 && withinHundred <= 14) return forms[2];
  if (lastDigit === 1) return forms[0];
  if (lastDigit >= 2 && lastDigit <= 4) return forms[1];
  return forms[2];
}

/** Nominative masculine ordinals, which every other case is built from. */
const ORDINALS: string[] = [
  "",
  "первый",
  "второй",
  "третий",
  "четвёртый",
  "пятый",
  "шестой",
  "седьмой",
  "восьмой",
  "девятый",
  "десятый",
  "одиннадцатый",
  "двенадцатый",
  "тринадцатый",
  "четырнадцатый",
  "пятнадцатый",
  "шестнадцатый",
  "семнадцатый",
  "восемнадцатый",
  "девятнадцатый",
  "двадцатый",
];

const TENS_ORDINAL: Record<number, string> = {
  20: "двадцатый",
  30: "тридцатый",
  40: "сороковой",
  50: "пятидесятый",
  60: "шестидесятый",
  70: "семидесятый",
  80: "восьмидесятый",
  90: "девяностый",
};

const TENS_CARDINAL: Record<number, string> = {
  20: "двадцать",
  30: "тридцать",
  40: "сорок",
  50: "пятьдесят",
  60: "шестьдесят",
  70: "семьдесят",
  80: "восемьдесят",
  90: "девяносто",
};

const HUNDREDS_CARDINAL: Record<number, string> = {
  100: "сто",
  200: "двести",
  300: "триста",
  400: "четыреста",
  500: "пятьсот",
  600: "шестьсот",
  700: "семьсот",
  800: "восемьсот",
  900: "девятьсот",
};

export type GrammaticalCase = "nominative" | "genitive" | "prepositional";

/**
 * Declines an ordinal. Only the last word of a compound changes — "двадцать
 * восьмого", never "двадцатого восьмого".
 */
function decline(ordinal: string, grammaticalCase: GrammaticalCase): string {
  if (grammaticalCase === "nominative") return ordinal;

  const parts = ordinal.split(" ");
  const last = parts[parts.length - 1];

  let declined: string;
  if (last === "третий") {
    declined = grammaticalCase === "genitive" ? "третьего" : "третьем";
  } else if (last.endsWith("ый") || last.endsWith("ой") || last.endsWith("ий")) {
    const stem = last.slice(0, -2);
    declined = grammaticalCase === "genitive" ? `${stem}ого` : `${stem}ом`;
  } else {
    declined = last;
  }

  parts[parts.length - 1] = declined;
  return parts.join(" ");
}

/** An ordinal below one hundred, nominative masculine. */
function ordinalUnderHundred(n: number): string {
  if (n <= 20) return ORDINALS[n] ?? "";
  const tens = Math.floor(n / 10) * 10;
  const unit = n % 10;
  if (unit === 0) return TENS_ORDINAL[tens] ?? "";
  return `${TENS_CARDINAL[tens]} ${ORDINALS[unit]}`;
}

/** The day of a month, as it is said: "двадцать восьмого". */
export function dayOrdinal(day: number, grammaticalCase: GrammaticalCase = "genitive"): string {
  if (day < 1 || day > 31) return String(day);
  return decline(ordinalUnderHundred(day), grammaticalCase);
}

/**
 * A year, as it is said: "две тысячи двадцать шестого". Covers 1900–2099,
 * which is every year this product will be asked about.
 */
export function yearOrdinal(year: number, grammaticalCase: GrammaticalCase = "genitive"): string {
  if (year < 1900 || year > 2099) return String(year);

  if (year === 2000) return decline("двухтысячный", grammaticalCase);

  if (year > 2000) {
    const rest = year - 2000;
    return `две тысячи ${decline(ordinalUnderHundred(rest), grammaticalCase)}`;
  }

  // 1900–1999. The hundreds are spoken as a cardinal; only the tail declines.
  const rest = year - 1900;
  if (rest === 0) return `тысяча ${decline("девятисотый", grammaticalCase)}`;
  return `тысяча ${HUNDREDS_CARDINAL[900]} ${decline(ordinalUnderHundred(rest), grammaticalCase)}`;
}

/** Cardinals in the genitive, which is the case nearly every preposition takes. */
const UNITS_GENITIVE = [
  "",
  "одного",
  "двух",
  "трёх",
  "четырёх",
  "пяти",
  "шести",
  "семи",
  "восьми",
  "девяти",
];

const TEENS_GENITIVE = [
  "десяти",
  "одиннадцати",
  "двенадцати",
  "тринадцати",
  "четырнадцати",
  "пятнадцати",
  "шестнадцати",
  "семнадцати",
  "восемнадцати",
  "девятнадцати",
];

const TENS_GENITIVE: Record<number, string> = {
  20: "двадцати",
  30: "тридцати",
  40: "сорока",
  50: "пятидесяти",
  60: "шестидесяти",
  70: "семидесяти",
  80: "восьмидесяти",
  90: "девяноста",
};

const HUNDREDS_GENITIVE: Record<number, string> = {
  100: "ста",
  200: "двухсот",
  300: "трёхсот",
  400: "четырёхсот",
  500: "пятисот",
  600: "шестисот",
  700: "семисот",
  800: "восьмисот",
  900: "девятисот",
};

/**
 * A number as it is said after a preposition: "от двенадцати до двадцати шести".
 *
 * A synthesiser reads every figure in the nominative, so "от 12 до 26" came out
 * as "от двенадцать до двадцать шесть" — the noun after it was already right,
 * and the number in front of it was still wrong. Returns null above what is
 * covered, so the caller leaves the digits alone rather than guessing.
 */
export function genitiveCardinal(n: number): string | null {
  if (!Number.isInteger(n) || n < 0 || n > 999) return null;
  if (n === 0) return "нуля";

  const hundreds = Math.floor(n / 100) * 100;
  const remainder = n % 100;

  const parts: string[] = [];
  if (hundreds) parts.push(HUNDREDS_GENITIVE[hundreds]);

  if (remainder >= 10 && remainder <= 19) {
    parts.push(TEENS_GENITIVE[remainder - 10]);
  } else {
    const tens = Math.floor(remainder / 10) * 10;
    const units = remainder % 10;
    if (tens) parts.push(TENS_GENITIVE[tens]);
    if (units) parts.push(UNITS_GENITIVE[units]);
  }

  return parts.join(" ");
}
