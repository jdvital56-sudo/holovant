import type { ModuleId } from "@holovant/module-contracts";
import { moduleRegistry } from "@/modules/registry";

export type VoiceIntent =
  | { kind: "open"; moduleId: ModuleId; label: string }
  | { kind: "rotate"; direction: "left" | "right"; label: string }
  | { kind: "close"; label: string }
  | { kind: "search"; query: string; label: string }
  | { kind: "play"; query: string; label: string }
  | { kind: "showFace"; show: boolean; label: string };

/**
 * Spoken names per module, in both languages the founder tests in. Recognisers
 * transcribe brand names inconsistently ("тик ток", "тикток", "tick tock"), so
 * each module carries several spellings rather than one canonical label.
 */
/**
 * Written as word stems, not whole words.
 *
 * Russian inflects: the module is "музыка" but nobody says that out loud —
 * they say "включи музыку". Matching on the full form silently failed for
 * every accusative, which is the case a command is normally spoken in, and
 * sent "открой систему" and "покажи погоду" off to the assistant as questions.
 */
const MODULE_ALIASES: Record<ModuleId, string[]> = {
  instagram: ["instagram", "insta", "инстаграм", "инста"],
  tiktok: ["tiktok", "tik tok", "тикток", "тик ток"],
  youtube: ["youtube", "you tube", "ютуб", "ютьюб"],
  x: ["twitter", "твиттер", "икс"],
  linkedin: ["linkedin", "linked in", "линкедин"],
  telegram: ["telegram", "телеграм", "телег"],
  stocks: ["stocks", "stock", "portfolio", "акци", "бирж", "портфел"],
  projects: ["projects", "project", "проект"],
  sports: ["sports", "sport", "спорт"],
  calendar: ["calendar", "schedule", "календар", "расписани"],
  weather: ["weather", "погод"],
  ai: ["ai", "assistant", "ии", "ассистент"],
  brain: ["brain", "second brain", "мозг", "второй мозг", "заметк", "знани", "база знаний"],
  news: ["news", "новост"],
  music: ["music", "музык"],
  system: ["system", "систем", "диагностик"],
};

const OPEN_VERBS = ["open", "show", "go to", "открой", "покажи", "открыть", "показать"];
const LEFT_WORDS = ["left", "влево", "налево"];
const RIGHT_WORDS = ["right", "вправо", "направо"];
const CLOSE_WORDS = ["close", "back", "dismiss", "закрой", "назад", "закрыть"];

function normalise(text: string) {
  return text
    .toLowerCase()
    .replace(/[.,!?;:"'()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsAny(haystack: string, needles: string[]) {
  return needles.some((n) => haystack.includes(n));
}

/**
 * Verbs that introduce a web search, longest first so "поищи" is not consumed
 * by a shorter prefix of itself.
 */
const SEARCH_VERBS = [
  "search the web for",
  "search for",
  "look up",
  "search",
  "google",
  "найди в интернете",
  "поищи в интернете",
  "поищи",
  "найди",
  "найти",
  "погугли",
  "загугли",
];

/** Filler that survives the verb but is not part of what to search for. */
const SEARCH_FILLER = ["мне", "пожалуйста", "please", "me", "for", "про", "about"];

const MIN_QUERY_WORDS = 1;

/** Verbs that ask for something to be played, longest first. */
const PLAY_VERBS = [
  "воспроизведи",
  "поставь трек",
  "поставь песню",
  "включи трек",
  "включи песню",
  "включи",
  "поставь",
  "play",
  "put on",
];

/**
 * Words naming the medium rather than the thing to play. "включи музыку" asks
 * for music in general and has no title in it; "включи музыку Radiohead" does.
 */
const MEDIUM_WORDS = ["музык", "песн", "трек", "music", "song", "track"];

function stripLeading(text: string, words: string[]): string {
  let result = text;
  let changed = true;
  while (changed) {
    changed = false;
    for (const word of words) {
      // Matches the word at the end of the phrase too, so "включи музыку"
      // strips down to nothing and opens the module instead of searching for
      // the word "музыку" as if it were a track title.
      const match = result.match(new RegExp(`^${word}\\S*(\\s+|$)`));
      if (match) {
        result = result.slice(match[0].length).trim();
        changed = true;
      }
    }
  }
  return result;
}

function matchPlay(text: string): VoiceIntent | null {
  const verb = PLAY_VERBS.find((v) => text.startsWith(`${v} `) || text === v);
  if (!verb) return null;

  // "включи музыку Radiohead" is a request for Radiohead; the word "музыку"
  // names the medium and is not part of what to search for.
  const query = stripLeading(text.slice(verb.length).trim(), [...MEDIUM_WORDS, ...SEARCH_FILLER]);

  // Nothing named: fall through so the module opens instead of a blind search.
  if (query.split(" ").filter(Boolean).length < 1) return null;
  return { kind: "play", query, label: `play “${query}”` };
}

/**
 * Asking the assistant to appear. Matched on the verb plus a word for itself,
 * so "покажи лицо" is distinguished from "покажи погоду" — one is a request to
 * be seen, the other to open a module.
 */
const FACE_SUBJECTS = ["лицо", "себя", "face", "yourself"];
const HIDE_VERBS = ["скрой", "спрячь", "убери", "hide"];

function matchFace(text: string): VoiceIntent | null {
  const namesItself = FACE_SUBJECTS.some((w) => text.includes(w));
  if (!namesItself) return null;

  if (HIDE_VERBS.some((v) => text.includes(v))) {
    return { kind: "showFace", show: false, label: "hide face" };
  }
  const asksToShow =
    containsAny(text, OPEN_VERBS) || text.includes("show") || text.includes("appear");
  if (!asksToShow) return null;
  return { kind: "showFace", show: true, label: "show face" };
}

function matchSearch(text: string): VoiceIntent | null {
  const verb = SEARCH_VERBS.find((v) => text.startsWith(`${v} `) || text === v);
  if (!verb) return null;

  let query = text.slice(verb.length).trim();
  // Strip leading filler only: the same words can be meaningful inside a query.
  let changed = true;
  while (changed) {
    changed = false;
    for (const filler of SEARCH_FILLER) {
      if (query.startsWith(`${filler} `)) {
        query = query.slice(filler.length + 1).trim();
        changed = true;
      }
    }
  }

  if (query.split(" ").filter(Boolean).length < MIN_QUERY_WORDS) return null;
  return { kind: "search", query, label: `search “${query}”` };
}

/**
 * Matches a spoken phrase to an intent. Returns null when nothing matches, so
 * the caller can leave the carousel alone rather than guess — a wrong guess
 * moves the interface under the user for no reason.
 */
export function matchIntent(rawTranscript: string): VoiceIntent | null {
  const text = normalise(rawTranscript);
  if (!text) return null;

  // Search is matched first and wins outright: "find some music" names a module
  // as its subject, and treating that as "open Music" would answer a question
  // the user did not ask.
  // Checked first: "покажи себя" contains an open verb and would otherwise
  // be read as a request to open a module.
  const face = matchFace(text);
  if (face) return face;

  const search = matchSearch(text);
  if (search) return search;

  // Before module matching, or "включи музыку Radiohead" would open the Music
  // module and ignore the artist entirely.
  const play = matchPlay(text);
  if (play) return play;

  // Naming exactly one direction is treated as a rotation, with or without a
  // verb — "rotate left" and a bare "left" mean the same thing out loud. Both
  // or neither falls through, since that is not a direction.
  const saysLeft = containsAny(text, LEFT_WORDS);
  const saysRight = containsAny(text, RIGHT_WORDS);
  if (saysLeft !== saysRight) {
    const direction = saysLeft ? "left" : "right";
    return { kind: "rotate", direction, label: `rotate ${direction}` };
  }

  if (containsAny(text, CLOSE_WORDS)) {
    return { kind: "close", label: "close" };
  }

  const saysOpenVerb = containsAny(text, OPEN_VERBS);
  for (const candidate of moduleRegistry) {
    const aliases = MODULE_ALIASES[candidate.id];
    if (!aliases) continue;
    if (containsAny(text, aliases)) {
      // A bare module name is treated as "open it" — saying "Instagram" with
      // nothing else can only reasonably mean one thing.
      if (saysOpenVerb || text.split(" ").length <= 3) {
        return { kind: "open", moduleId: candidate.id, label: `open ${candidate.label}` };
      }
    }
  }

  return null;
}

/**
 * The line the system says back. Confirming out loud is what makes voice feel
 * answered rather than ignored — without it a command that worked and a
 * command that was misheard look identical from across the room.
 */
export function replyFor(intent: VoiceIntent, lang: "ru" | "en"): string {
  const moduleLabel =
    intent.kind === "open"
      ? (moduleRegistry.find((m) => m.id === intent.moduleId)?.label ?? "")
      : "";

  if (lang === "ru") {
    switch (intent.kind) {
      case "open":
        return `Открываю ${moduleLabel}`;
      case "rotate":
        return intent.direction === "left" ? "Влево" : "Вправо";
      case "close":
        return "Закрываю";
      case "search":
        return `Ищу: ${intent.query}`;
      case "play":
        return `Включаю: ${intent.query}`;
      case "showFace":
        return intent.show ? "Я здесь" : "Скрываюсь";
    }
  }

  switch (intent.kind) {
    case "open":
      return `Opening ${moduleLabel}`;
    case "rotate":
      return intent.direction === "left" ? "Left" : "Right";
    case "close":
      return "Closing";
    case "search":
      return `Searching for ${intent.query}`;
    case "play":
      return `Playing ${intent.query}`;
    case "showFace":
      return intent.show ? "I am here" : "Hiding";
  }
}
