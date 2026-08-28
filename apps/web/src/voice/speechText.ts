/**
 * Turning written text into text a synthesiser can say.
 *
 * Pure string work, deliberately free of anything browser-shaped, so it can be
 * tested directly — every rule here exists because the founder heard a mark
 * read out by its name.
 */

import { pluralRu, dayOrdinal, yearOrdinal, type GrammaticalCase, type NounForms } from "./russianNumbers";

export type SpeechLang = "ru" | "en";

/**
 * Strips formatting a synthesiser would read out as the names of punctuation.
 * The model answers in Markdown — "**bold**", "- point", "— aside", "### head"
 * — and both Piper and the browser voice will literally say "звёздочка",
 * "тире", "решётка" for those. This keeps the words and drops the marks.
 */
export function forSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ") // fenced code
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links -> their text
    .replace(/^\s{0,3}#{1,6}\s+/gm, "") // headings
    .replace(/^\s{0,3}>\s?/gm, "") // block quotes
    .replace(/^\s{0,3}[-*+•·—–]\s+/gm, "") // bullet markers
    .replace(/^\s{0,3}\d+[.)]\s+/gm, "") // numbered list markers
    .replace(/\*\*([^*]+)\*\*/g, "$1") // bold
    .replace(/\*([^*]+)\*/g, "$1") // italic *
    .replace(/(^|[\s(])_([^_]+)_(?=[\s).,!?:;]|$)/g, "$1$2") // italic _
    .replace(/[*_`#|~]/g, " ") // any leftover markup character
    .replace(/\s*[—–]\s*/g, ", ") // dash used as an aside -> a pause
    .replace(/\s+-\s+/g, ", ") // hyphen used the same way
    .replace(/\.{2,}/g, "…") // "..." read as three separate stops
    .replace(/,\s*,/g, ",")
    .replace(/\s+([,.!?;:…])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/**
 * Turns figures into something a synthesiser says as a person would.
 *
 * "$80,270" was read out as "знак доллара восемьдесят запятая двести семьдесят",
 * and "44.48" as "сорок четыре точка сорок восемь". The separators and symbols
 * are punctuation to the voice and quantity to the listener, so they are
 * resolved into words here rather than left for it to guess.
 *
 * Speech only. The panel keeps "$80,270", which is what is readable on screen.
 */
export function forVoice(text: string, lang: SpeechLang = "ru"): string {
  const ru = lang === "ru";

  // A dash between two figures is a range, said with words. Done before the
  // markdown pass, which turns every dash into a comma and would leave
  // "44,30–44,40" sounding like two separate prices.
  const ranged = text
    .replace(/(\d[\d.,]*)\s*[—–-]\s*(\d[\d.,]*)/g, ru ? "от $1 до $2" : "$1 to $2")
    // "сегодня от 12–22" already had the preposition and would gain a second.
    // Anchored on whitespace rather than \b, which is ASCII-only and does not
    // see the edge of a Russian word at all.
    .replace(/(^|\s)от\s+от(?=\s)/giu, "$1от")
    .replace(/(^|\s)до\s+до(?=\s)/giu, "$1до");

  let out = forSpeech(ranged);

  // Dates before anything else touches the digits: a day is an ordinal and so
  // is a year, and "28 августа 2026" read as cardinals is what made the
  // assistant sound like a toy. Before the decimal rule too, which would
  // otherwise read "28.08.2026" as a number with a fraction in it.
  if (ru) out = spellDates(out);

  // Thousands separators first, so a grouped number is one quantity before
  // anything looks for a decimal point in it.
  for (let pass = 0; pass < 3; pass++) {
    out = out.replace(/(\d),(\d{3})\b/g, "$1$2").replace(/(\d)[  ](\d{3})\b/g, "$1$2");
  }

  // Currency and units, before the decimal split so "$44.48" keeps its symbol
  // attached to the whole figure.
  // The whole figure is captured, not its first digit: "$100" must not become
  // "1 долларов 00".
  const AMOUNT = String.raw`(\d+(?:[.,]\d+)?)`;

  /**
   * Replaces a symbol and its figure with the figure and the noun in the form
   * that number requires: 1 доллар, 2 доллара, 5 долларов. Everything used to
   * take the last of the three, which is wrong after most numbers.
   */
  const withUnit = (pattern: string, forms: NounForms, english: string) => {
    out = out.replace(new RegExp(pattern, "g"), (_whole, amount: string) =>
      ru ? `${amount} ${pluralRu(toNumber(amount), forms)}` : `${amount} ${english}`,
    );
  };

  const DOLLARS: NounForms = ["доллар", "доллара", "долларов"];
  const EUROS: NounForms = ["евро", "евро", "евро"];
  const HRYVNIA: NounForms = ["гривна", "гривны", "гривен"];
  const POUNDS: NounForms = ["фунт", "фунта", "фунтов"];
  const DEGREES: NounForms = ["градус", "градуса", "градусов"];

  withUnit(`\\$\\s?${AMOUNT}`, DOLLARS, "dollars");
  withUnit(`€\\s?${AMOUNT}`, EUROS, "euros");
  withUnit(`₴\\s?${AMOUNT}`, HRYVNIA, "hryvnia");
  withUnit(`£\\s?${AMOUNT}`, POUNDS, "pounds");

  // And the same symbols written after the figure, which is how they appear in
  // Ukrainian and most European copy: "45,30 ₴".
  withUnit(`${AMOUNT}\\s?₴`, HRYVNIA, "hryvnia");
  withUnit(`${AMOUNT}\\s?€`, EUROS, "euros");
  withUnit(`${AMOUNT}\\s?\\$`, DOLLARS, "dollars");

  // A trailing symbol reads as its name, not its punctuation.
  withUnit(`${AMOUNT}\\s?%`, ["процент", "процента", "процентов"], "percent");
  withUnit(`${AMOUNT}\\s?°\\s?[CС]`, DEGREES, "degrees");
  withUnit(`${AMOUNT}\\s?°`, DEGREES, "degrees");

  // Units written with a slash. "8 км/ч" was read as "восемь километров дробь
  // че" and "10 Мбит/с" the same way — the mark is shorthand on a screen and
  // the word "per" out loud.
  out = out
    .replace(/км\s?\/\s?ч/gi, ru ? "километров в час" : "kilometres per hour")
    .replace(/м\s?\/\s?с/gi, ru ? "метров в секунду" : "metres per second")
    .replace(/(М|Г|К)бит\s?\/\s?с/gi, (_m, p) =>
      ru
        ? `${{ М: "мега", Г: "гига", К: "кило" }[p as "М" | "Г" | "К"] ?? ""}бит в секунду`
        : "megabits per second",
    )
    .replace(/(М|Г|К)Б\s?\/\s?с/g, (_m, p) =>
      ru
        ? `${{ М: "мега", Г: "гига", К: "кило" }[p as "М" | "Г" | "К"] ?? ""}байт в секунду`
        : "megabytes per second",
    )
    .replace(/km\s?\/\s?h/gi, ru ? "километров в час" : "kilometres per hour")
    .replace(/mb\s?\/\s?s/gi, ru ? "мегабит в секунду" : "megabits per second")
    .replace(/24\s?\/\s?7/g, ru ? "круглосуточно" : "around the clock")
    .replace(/и\s?\/\s?или/gi, "или");

  // A clock time. "22:08" is read as "двадцать два ноль восемь" or worse, as
  // the colon by name; said aloud it is hours and minutes, each agreeing with
  // its own number.
  if (ru) {
    out = out.replace(/(\d{1,2}):(\d{2})(?::\d{2})?/g, (_whole, h: string, m: string) => {
      const hours = Number(h);
      const minutes = Number(m);
      if (hours > 23 || minutes > 59) return _whole;
      const hourWord = pluralRu(hours, ["час", "часа", "часов"]);
      const minuteWord = pluralRu(minutes, ["минута", "минуты", "минут"]);
      // A leading zero would otherwise be read out as the word "ноль".
      return minutes === 0
        ? `${hours} ${hourWord} ровно`
        : `${hours} ${hourWord} ${minutes} ${minuteWord}`;
    });
  }

  // A dimension: "1920×1080" is two numbers with a word between them, not the
  // multiplication sign said by name.
  out = out.replace(/(\d)\s?[×x✕]\s?(\d)/g, ru ? "$1 на $2" : "$1 by $2");

  // Web addresses are unreadable aloud and belong on the panel, not in speech.
  out = out.replace(/https?:\/\/\S+/gi, "").replace(/www\.\S+/gi, "");

  // Whatever slash is left. Between digits it is a date or a ratio and reads as
  // a pause; between words it is an alternative.
  out = out
    .replace(/(\d)\s?\/\s?(\d)/g, "$1 $2")
    .replace(/\s?\/\s?/g, ru ? " или " : " or ");

  out = out.replace(/\s?&\s?/g, ru ? " и " : " and ").replace(/№\s?(\d)/g, ru ? "номер $1" : "number $1");

  // Abbreviations. Written they are read at a glance; spoken they come out as
  // letters — "44,57 грн" was said as "грны". A synthesiser has no way to guess
  // these, so they are spelled out here.
  //
  // Boundaries are lookarounds rather than a word boundary, which in JavaScript is
  // ASCII-only and never fires between a space and a Cyrillic letter.
  out = expandAbbreviations(out, ru);

  // The decimal separator itself. Said aloud a person joins the halves with a
  // word, never with the name of the mark between them.
  out = out.replace(/(\d+)[.,](\d+)/g, ru ? "$1 и $2" : "$1 point $2");

  return out.replace(/\s{2,}/g, " ").replace(/\s+([,.!?;:…])/g, "$1").trim();
}

/**
 * A boundary that works for Cyrillic, unlike JavaScript's `\b`, which is
 * ASCII-only and never fires between a space and a Russian letter.
 *
 * Built with String.raw throughout: an ordinary template literal quietly turns
 * an unrecognised escape into the bare letter, so `\p{L}` becomes `p{L}` and
 * the pattern matches nothing while still looking correct.
 */
const EDGE_BEFORE = String.raw`(?<![\p{L}\p{N}])`;
const EDGE_AFTER = String.raw`(?![\p{L}\p{N}])`;

function wordish(pattern: string): RegExp {
  return new RegExp(`${EDGE_BEFORE}(?:${pattern})${EDGE_AFTER}`, "giu");
}

/**
 * Short forms and what to say instead. Currency and magnitude words are
 * unambiguous on their own; the plain units are only expanded after a figure,
 * because "см" is as likely to be "смотри" as it is centimetres.
 */
const SPOKEN_FORMS: Array<{
  short: string;
  ru: string | NounForms;
  en: string;
  needsNumber?: boolean;
}> = [
  { short: String.raw`грн\.?`, ru: ["гривна", "гривны", "гривен"], en: "hryvnia" },
  { short: String.raw`руб\.?`, ru: ["рубль", "рубля", "рублей"], en: "roubles" },
  { short: String.raw`долл\.?`, ru: ["доллар", "доллара", "долларов"], en: "dollars" },
  { short: String.raw`коп\.?`, ru: ["копейка", "копейки", "копеек"], en: "kopecks" },
  { short: String.raw`тыс\.?`, ru: ["тысяча", "тысячи", "тысяч"], en: "thousand" },
  { short: String.raw`млн\.?`, ru: ["миллион", "миллиона", "миллионов"], en: "million" },
  { short: String.raw`млрд\.?`, ru: ["миллиард", "миллиарда", "миллиардов"], en: "billion" },
  { short: String.raw`трлн\.?`, ru: ["триллион", "триллиона", "триллионов"], en: "trillion" },
  { short: String.raw`т\.\s?е\.`, ru: "то есть", en: "that is" },
  { short: String.raw`т\.\s?д\.`, ru: "так далее", en: "so on" },
  { short: String.raw`т\.\s?п\.`, ru: "тому подобное", en: "so forth" },
  { short: String.raw`др\.`, ru: "другие", en: "others" },
  { short: "кг", ru: ["килограмм", "килограмма", "килограммов"], en: "kilograms", needsNumber: true },
  { short: "км", ru: ["километр", "километра", "километров"], en: "kilometres", needsNumber: true },
  { short: "см", ru: ["сантиметр", "сантиметра", "сантиметров"], en: "centimetres", needsNumber: true },
  { short: "мм", ru: ["миллиметр", "миллиметра", "миллиметров"], en: "millimetres", needsNumber: true },
  { short: String.raw`шт\.?`, ru: ["штука", "штуки", "штук"], en: "pieces", needsNumber: true },
  { short: String.raw`мин\.`, ru: ["минута", "минуты", "минут"], en: "minutes", needsNumber: true },
  { short: String.raw`сек\.`, ru: ["секунда", "секунды", "секунд"], en: "seconds", needsNumber: true },
  { short: String.raw`ч\.`, ru: ["час", "часа", "часов"], en: "hours", needsNumber: true },
  // Hardware shorthand the System module speaks. Left as letters a Russian
  // voice reads them one at a time, which is how "16 GB RAM" came out.
  { short: "GB|ГБ", ru: ["гигабайт", "гигабайта", "гигабайт"], en: "gigabytes", needsNumber: true },
  { short: "MB|МБ", ru: ["мегабайт", "мегабайта", "мегабайт"], en: "megabytes", needsNumber: true },
  { short: "TB|ТБ", ru: ["терабайт", "терабайта", "терабайт"], en: "terabytes", needsNumber: true },
  { short: "GHz|ГГц", ru: ["гигагерц", "гигагерца", "гигагерц"], en: "gigahertz", needsNumber: true },
  { short: "MHz|МГц", ru: ["мегагерц", "мегагерца", "мегагерц"], en: "megahertz", needsNumber: true },
  { short: "RAM", ru: "оперативной памяти", en: "RAM" },
  { short: "fps|FPS", ru: "кадров в секунду", en: "frames per second" },
];

function expandAbbreviations(text: string, ru: boolean): string {
  let out = text;
  for (const form of SPOKEN_FORMS) {
    const said = ru ? form.ru : form.en;
    if (form.needsNumber) {
      // The figure decides which of the three forms the noun takes, so the
      // replacement is a function rather than a fixed string: "1 километр",
      // "2 километра", "5 километров".
      out = out.replace(
        new RegExp(String.raw`(\d+(?:[.,]\d+)?)\s?(?:${form.short})` + EDGE_AFTER, "giu"),
        (_whole, amount: string) =>
          `${amount} ${Array.isArray(said) ? pluralRu(toNumber(amount), said) : said}`,
      );
    } else {
      // A figure in front still decides the form — "21 млн" is "миллион", not
      // "миллионов". Only what is left standing alone falls back to the plural.
      if (Array.isArray(said)) {
        out = out.replace(
          new RegExp(String.raw`(\d+(?:[.,]\d+)?)\s?(?:${form.short})` + EDGE_AFTER, "giu"),
          (_whole, amount: string) => `${amount} ${pluralRu(toNumber(amount), said)}`,
        );
      }
      out = out.replace(wordish(form.short), Array.isArray(said) ? said[2] : said);
    }
  }
  return out;
}

/** "44,57" as a number, so agreement can be decided from it. */
function toNumber(amount: string): number {
  return Number(amount.replace(",", "."));
}

/** Month names in the genitive, which is the form a date is spoken in. */
const MONTHS_GENITIVE = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

/** Enough of each month to recognise whatever case it was written in. */
const MONTH_STEMS = [
  "январ",
  "феврал",
  "март",
  "апрел",
  "ма",
  "июн",
  "июл",
  "август",
  "сентябр",
  "октябр",
  "ноябр",
  "декабр",
];

/**
 * Dates, spoken the way a person says them.
 *
 * "28 августа 2026 года" is read by a synthesiser as "двадцать восемь августа
 * две тысячи двадцать шесть" — cardinal where Russian requires an ordinal, in
 * both halves. It is the single thing that made the voice sound unfinished.
 */
function spellDates(text: string): string {
  let out = text;

  // "28.08.2026" and "28/08/2026" — a written date, before any rule reads the
  // dots as a decimal point.
  out = out.replace(/(\d{1,2})[./](\d{1,2})[./](\d{4})/g, (whole, d, m, y) => {
    const day = Number(d);
    const month = Number(m);
    const year = Number(y);
    if (day < 1 || day > 31 || month < 1 || month > 12) return whole;
    return `${dayOrdinal(day)} ${MONTHS_GENITIVE[month - 1]} ${yearOrdinal(year)} года`;
  });

  // "28 августа 2026 года" / "28 августа" — a day followed by a month name.
  const monthPattern = MONTH_STEMS.join("|");
  out = out.replace(
    new RegExp(String.raw`(\d{1,2})\s+(${monthPattern})\S*`, "gi"),
    (whole, d: string, stem: string) => {
      const day = Number(d);
      if (day < 1 || day > 31) return whole;
      const index = MONTH_STEMS.findIndex((m) => m === stem.toLowerCase());
      if (index < 0) return whole;
      return `${dayOrdinal(day)} ${MONTHS_GENITIVE[index]}`;
    },
  );

  // A year with the word that follows it deciding the case: "2026 года",
  // "в 2026 году", "2026 год".
  out = out
    .replace(/(\d{4})\s+года/g, (whole, y) => yearWord(whole, Number(y), "genitive", "года"))
    .replace(/(\d{4})\s+году/g, (whole, y) => yearWord(whole, Number(y), "prepositional", "году"))
    .replace(/(\d{4})\s+год(?![а-яё])/gi, (whole, y) =>
      yearWord(whole, Number(y), "nominative", "год"),
    );

  return out;
}

function yearWord(
  whole: string,
  year: number,
  grammaticalCase: GrammaticalCase,
  noun: string,
): string {
  if (year < 1900 || year > 2099) return whole;
  return `${yearOrdinal(year, grammaticalCase)} ${noun}`;
}
