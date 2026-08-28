/**
 * Turning written text into text a synthesiser can say.
 *
 * Pure string work, deliberately free of anything browser-shaped, so it can be
 * tested directly — every rule here exists because the founder heard a mark
 * read out by its name.
 */

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
  out = out
    .replace(new RegExp(`\\$\\s?${AMOUNT}`, "g"), ru ? "$1 долларов" : "$1 dollars")
    .replace(new RegExp(`€\\s?${AMOUNT}`, "g"), ru ? "$1 евро" : "$1 euros")
    .replace(new RegExp(`₴\\s?${AMOUNT}`, "g"), ru ? "$1 гривен" : "$1 hryvnia")
    .replace(new RegExp(`£\\s?${AMOUNT}`, "g"), ru ? "$1 фунтов" : "$1 pounds");

  // And the same symbols written after the figure, which is how they appear in
  // Ukrainian and most European copy: "45,30 ₴".
  out = out
    .replace(new RegExp(`${AMOUNT}\\s?₴`, "g"), ru ? "$1 гривен" : "$1 hryvnia")
    .replace(new RegExp(`${AMOUNT}\\s?€`, "g"), ru ? "$1 евро" : "$1 euros")
    .replace(new RegExp(`${AMOUNT}\\s?\\$`, "g"), ru ? "$1 долларов" : "$1 dollars");

  // A trailing symbol reads as its name, not its punctuation.
  out = out
    .replace(/(\d)\s?%/g, ru ? "$1 процентов" : "$1 percent")
    .replace(/(\d)\s?°\s?[CС]/g, ru ? "$1 градусов" : "$1 degrees")
    .replace(/(\d)\s?°/g, ru ? "$1 градусов" : "$1 degrees");

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
const SPOKEN_FORMS: Array<{ short: string; ru: string; en: string; needsNumber?: boolean }> = [
  { short: String.raw`грн\.?`, ru: "гривен", en: "hryvnia" },
  { short: String.raw`руб\.?`, ru: "рублей", en: "roubles" },
  { short: String.raw`долл\.?`, ru: "долларов", en: "dollars" },
  { short: String.raw`коп\.?`, ru: "копеек", en: "kopecks" },
  { short: String.raw`тыс\.?`, ru: "тысяч", en: "thousand" },
  { short: String.raw`млн\.?`, ru: "миллионов", en: "million" },
  { short: String.raw`млрд\.?`, ru: "миллиардов", en: "billion" },
  { short: String.raw`трлн\.?`, ru: "триллионов", en: "trillion" },
  { short: String.raw`т\.\s?е\.`, ru: "то есть", en: "that is" },
  { short: String.raw`т\.\s?д\.`, ru: "так далее", en: "so on" },
  { short: String.raw`т\.\s?п\.`, ru: "тому подобное", en: "so forth" },
  { short: String.raw`др\.`, ru: "другие", en: "others" },
  { short: "кг", ru: "килограммов", en: "kilograms", needsNumber: true },
  { short: "км", ru: "километров", en: "kilometres", needsNumber: true },
  { short: "см", ru: "сантиметров", en: "centimetres", needsNumber: true },
  { short: "мм", ru: "миллиметров", en: "millimetres", needsNumber: true },
  { short: String.raw`шт\.?`, ru: "штук", en: "pieces", needsNumber: true },
  { short: String.raw`мин\.`, ru: "минут", en: "minutes", needsNumber: true },
  { short: String.raw`сек\.`, ru: "секунд", en: "seconds", needsNumber: true },
  { short: String.raw`ч\.`, ru: "часов", en: "hours", needsNumber: true },
  // Hardware shorthand the System module speaks. Left as letters a Russian
  // voice reads them one at a time, which is how "16 GB RAM" came out.
  { short: "GB|ГБ", ru: "гигабайт", en: "gigabytes", needsNumber: true },
  { short: "MB|МБ", ru: "мегабайт", en: "megabytes", needsNumber: true },
  { short: "TB|ТБ", ru: "терабайт", en: "terabytes", needsNumber: true },
  { short: "GHz|ГГц", ru: "гигагерц", en: "gigahertz", needsNumber: true },
  { short: "MHz|МГц", ru: "мегагерц", en: "megahertz", needsNumber: true },
  { short: "RAM", ru: "оперативной памяти", en: "RAM" },
  { short: "fps|FPS", ru: "кадров в секунду", en: "frames per second" },
];

function expandAbbreviations(text: string, ru: boolean): string {
  let out = text;
  for (const form of SPOKEN_FORMS) {
    const said = ru ? form.ru : form.en;
    if (form.needsNumber) {
      out = out.replace(
        new RegExp(String.raw`(\d)\s?(?:${form.short})` + EDGE_AFTER, "giu"),
        `$1 ${said}`,
      );
    } else {
      out = out.replace(wordish(form.short), said);
    }
  }
  return out;
}
