import type { ModuleId } from "@holovant/module-contracts";
import { moduleRegistry } from "@/modules/registry";
import { assistantAliases } from "@/config/assistant";

export type VoiceIntent =
  | { kind: "open"; moduleId: ModuleId; label: string }
  | { kind: "rotate"; direction: "left" | "right"; label: string }
  | { kind: "close"; label: string }
  | { kind: "search"; query: string; label: string }
  | { kind: "play"; query: string; label: string }
  | { kind: "favoriteAdd"; playlist: string | null; label: string }
  | { kind: "favoritePlay"; playlist: string | null; label: string }
  | { kind: "playlistList"; label: string }
  | { kind: "pause"; label: string }
  | { kind: "resume"; label: string }
  | { kind: "next"; label: string }
  | { kind: "showFace"; show: boolean; label: string }
  | { kind: "wake"; label: string }
  | { kind: "volume"; direction: "up" | "down"; label: string }
  | { kind: "dismiss"; target: "chat" | "player" | "all"; label: string };

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
  const rest = text.slice(verb.length).trim();

  // "Включи Instagram" is a request to open a module, not to find a track
  // called Instagram. Without this it went to YouTube, played a video about
  // Instagram, and the module never opened — which reads as no reaction at all.
  for (const candidate of moduleRegistry) {
    const aliases = MODULE_ALIASES[candidate.id];
    // Music is the exception: "включи музыку" is about playing, not opening.
    if (!aliases || candidate.id === "music") continue;
    if (containsAny(rest, aliases)) {
      return { kind: "open", moduleId: candidate.id, label: `open ${candidate.label}` };
    }
  }

  const query = stripLeading(rest, [...MEDIUM_WORDS, ...SEARCH_FILLER]);

  if (query.split(" ").filter(Boolean).length < 1) {
    // "включи музыку" with no title. If a medium word was actually said, play
    // a default stream — "play music" that plays nothing is a broken promise.
    // A bare "включи" with no medium still falls through to module matching.
    if (MEDIUM_WORDS.some((w) => rest.includes(w))) {
      return { kind: "play", query: "", label: "play music" };
    }
    return null;
  }
  return { kind: "play", query, label: `play “${query}”` };
}

/**
 * Transport control for whatever is playing. Separate from the play matcher
 * because "поставь на паузу" and "поставь Radiohead" share a verb and mean
 * opposite things, and from dismiss because pausing keeps the track loaded —
 * closing the panel loses it.
 */
function matchPlayback(text: string): VoiceIntent | null {
  if (/(^|\s)(пауза|паузу|приостанови|притормози|pause)(\s|$)/.test(text)) {
    return { kind: "pause", label: "pause" };
  }
  if (/(^|\s)(продолжи|продолжай|дальше|возобнови|resume|continue)(\s|$)/.test(text)) {
    return { kind: "resume", label: "resume" };
  }
  if (/(^|\s)(следующ\S*|переключи трек|next|skip)(\s|$)/.test(text)) {
    return { kind: "next", label: "next track" };
  }
  return null;
}

/** Verbs that ask for a track to be saved, or the collection to be named. */
const REMEMBER_VERBS = ["запомни", "запиши", "сохрани", "добавь", "remember", "save"];
const FORGET_VERBS = ["убери", "удали", "забудь", "remove", "delete"];
const FAVORITE_WORDS = [
  "избранн",
  "favorite",
  "favourite",
  "сборник",
  "подборк",
  "плейлист",
  "playlist",
];

/**
 * "Запомни этот трек" saves whatever is playing; "включи избранное" plays the
 * saved collection back. Checked before the play matcher so "включи мою музыку"
 * reaches the collection instead of the default stream.
 */
function matchFavorites(text: string): VoiceIntent | null {
  // "Моя любимая музыка" has a word between the possessive and the noun, which
  // an adjacency test missed — it fell through to opening the Music module, and
  // the saved tracks looked like they had never been saved at all.
  const namesMine = /(^|\s)(мо[йяю]|мои|наш[аиу]?)(\s|$)/.test(text) || /\bmy\b/.test(text);
  const namesLoved = /любим|favou?rite/.test(text);
  const namesMedium = containsAny(text, MEDIUM_WORDS) || /\b(music|tracks?|songs?)\b/.test(text);

  const namesFavorites =
    containsAny(text, FAVORITE_WORDS) ||
    ((namesMine || namesLoved) && namesMedium) ||
    (namesMine && namesLoved);

  const namesThis =
    containsAny(text, MEDIUM_WORDS) || /(^|\s)(это|этот|эту)(\s|$)/.test(text) || /\bthis\b/.test(text);

  // "Какие у меня подборки" is a question about the collections themselves,
  // and must not be answered by playing one.
  if (
    namesFavorites &&
    /(^|\s)(каки|какие|что|сколько|перечисли|список|назови|what|which|list)/.test(text)
  ) {
    return { kind: "playlistList", label: "list playlists" };
  }

  const playlist = playlistNameIn(text);

  if (containsAny(text, REMEMBER_VERBS) && (namesFavorites || namesThis)) {
    return { kind: "favoriteAdd", playlist, label: playlist ? `save to ${playlist}` : "save track" };
  }

  if (!namesFavorites) return null;
  // "убери из избранного" is a removal, not a request to play it. Removal by
  // voice is not built yet, so leave it alone rather than playing instead.
  if (containsAny(text, FORGET_VERBS)) return null;
  return {
    kind: "favoritePlay",
    playlist,
    label: playlist ? `play ${playlist}` : "play favorites",
  };
}

/**
 * The name of a collection inside a spoken phrase.
 *
 * "Сохрани в подборку для работы" names one; "включи избранное" does not.
 * Everything after the word for a collection is the name, minus the small
 * words a person puts in front of it.
 */
function playlistNameIn(text: string): string | null {
  const match = text.match(
    /(?:подборк\S*|сборник\S*|плейлист\S*|playlist)\s+(.+)$/,
  );
  if (!match) return null;

  const name = match[1]
    .replace(/^(в|во|из|к|на|to|in|from)\s+/, "")
    .replace(/\s+(пожалуйста|please)$/, "")
    .trim();

  return name.length >= 2 ? name : null;
}

/**
 * Asking the assistant to appear. Matched on the verb plus a word for itself,
 * so "покажи лицо" is distinguished from "покажи погоду" — one is a request to
 * be seen, the other to open a module.
 */
const FACE_SUBJECTS = ["лицо", "себя", "face", "yourself"];
const HIDE_VERBS = [
  "скрой",
  "спрячь",
  "убери",
  "убрать",
  // "закрой лицо" and "выключи лицо" are the same request. Without these they
  // fell through to the generic close verb and did nothing to the face at all.
  "закрой",
  "закрыть",
  "выключи",
  "выруби",
  "hide",
  "close",
];

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

/**
 * Just the assistant's name, or the name with a word or two after it — a call
 * for attention. "Вита" alone should get "Да, сэр", not be sent to the model.
 */
function matchWake(text: string): VoiceIntent | null {
  const words = text.split(" ").filter(Boolean);
  if (!words.length || words.length > 3) return null;
  const aliases = assistantAliases();
  if (!aliases.includes(words[0])) return null;
  // "тор покажи лицо" is a command with a name in front — let it fall through.
  const rest = words.slice(1).join(" ");
  if (!rest || ["ты тут", "ты здесь", "you there", "here"].includes(rest)) {
    return { kind: "wake", label: "wake" };
  }
  return null;
}

const LOUDER_WORDS = ["громче", "погромче", "прибавь", "louder", "volume up"];
const QUIETER_WORDS = ["тише", "потише", "убавь", "quieter", "softer", "volume down"];

function matchVolume(text: string): VoiceIntent | null {
  if (containsAny(text, LOUDER_WORDS)) return { kind: "volume", direction: "up", label: "louder" };
  if (containsAny(text, QUIETER_WORDS)) return { kind: "volume", direction: "down", label: "quieter" };
  return null;
}

/** "Убери чат", "закрой плеер", "убери всё" — clearing what is on screen. */
function matchDismiss(text: string): VoiceIntent | null {
  const clears = containsAny(text, [
    "убери",
    "убрать",
    "закрой",
    "закрыть",
    "скрой",
    "выключи",
    "выруби",
    "останови",
    "заглуши",
    "пауза",
    "clear",
    "close",
    "hide",
    "pause",
  ]);
  if (!clears) return null;
  if (/чат|ответ|chat|answer/.test(text)) return { kind: "dismiss", target: "chat", label: "dismiss chat" };
  if (/плеер|player|музык|music|трек|track/.test(text))
    return { kind: "dismiss", target: "player", label: "dismiss player" };
  if (/(^|\s)вс[её](\s|$)|everything|\ball\b/.test(text))
    return { kind: "dismiss", target: "all", label: "dismiss all" };
  return null;
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
  let text = normalise(rawTranscript);
  if (!text) return null;

  // Just the name on its own — a call for attention, answered directly.
  const wake = matchWake(text);
  if (wake) return wake;

  // The name in front of a command is only addressing ("Вита, включи музыку").
  // Strip it so the rest matches as if it had been said alone.
  const words = text.split(" ");
  if (words.length > 1 && assistantAliases().includes(words[0])) {
    text = words.slice(1).join(" ");
  }

  // Checked first: "покажи себя" contains an open verb and would otherwise
  // be read as a request to open a module.
  const face = matchFace(text);
  if (face) return face;

  // Before dismiss: "останови музыку" is a pause, not a request to close the
  // player and lose the track.
  const playback = matchPlayback(text);
  if (playback) return playback;

  const dismiss = matchDismiss(text);
  if (dismiss) return dismiss;

  const volume = matchVolume(text);
  if (volume) return volume;

  const search = matchSearch(text);
  if (search) return search;

  // Before the play matcher: "включи мою музыку" is the saved collection, not
  // a request for the default stream.
  const favorites = matchFavorites(text);
  if (favorites) return favorites;

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
        return intent.query ? `Включаю: ${intent.query}` : "Включаю музыку";
      // Spoken by the caller, which knows the track title and the new count.
      case "favoriteAdd":
      case "favoritePlay":
      case "playlistList":
        return "";
      case "showFace":
        return intent.show ? "Я здесь" : "Скрываюсь";
      case "wake":
        return "Да, сэр";
      case "pause":
        return "Пауза";
      case "resume":
        return "Продолжаю";
      case "next":
        return "Следующий";
      case "volume":
        return intent.direction === "up" ? "Громче" : "Тише";
      case "dismiss":
        return "";
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
      return intent.query ? `Playing ${intent.query}` : "Playing music";
    case "favoriteAdd":
    case "favoritePlay":
    case "playlistList":
      return "";
    case "showFace":
      return intent.show ? "I am here" : "Hiding";
    case "wake":
      return "Yes, sir";
    case "pause":
      return "Paused";
    case "resume":
      return "Resuming";
    case "next":
      return "Next";
    case "volume":
      return intent.direction === "up" ? "Louder" : "Quieter";
    case "dismiss":
      return "";
  }
}
