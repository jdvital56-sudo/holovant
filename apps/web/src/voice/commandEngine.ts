import type { ModuleId } from "@holovant/module-contracts";
import { moduleRegistry } from "@/modules/registry";

export type VoiceIntent =
  | { kind: "open"; moduleId: ModuleId; label: string }
  | { kind: "rotate"; direction: "left" | "right"; label: string }
  | { kind: "close"; label: string };

/**
 * Spoken names per module, in both languages the founder tests in. Recognisers
 * transcribe brand names inconsistently ("тик ток", "тикток", "tick tock"), so
 * each module carries several spellings rather than one canonical label.
 */
const MODULE_ALIASES: Record<ModuleId, string[]> = {
  instagram: ["instagram", "insta", "инстаграм", "инста", "инстаграмм"],
  tiktok: ["tiktok", "tik tok", "тикток", "тик ток"],
  youtube: ["youtube", "you tube", "ютуб", "ютьюб"],
  x: ["twitter", "твиттер", "икс"],
  linkedin: ["linkedin", "linked in", "линкедин"],
  telegram: ["telegram", "телеграм", "телега", "телеграмм"],
  stocks: ["stocks", "stock", "portfolio", "акции", "биржа", "портфель"],
  projects: ["projects", "project", "проекты", "проект"],
  sports: ["sports", "sport", "спорт"],
  calendar: ["calendar", "schedule", "календарь", "расписание"],
  weather: ["weather", "погода"],
  ai: ["ai", "assistant", "ии", "ассистент"],
  news: ["news", "новости"],
  music: ["music", "музыка"],
  system: ["system", "система", "диагностика"],
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
 * Matches a spoken phrase to an intent. Returns null when nothing matches, so
 * the caller can leave the carousel alone rather than guess — a wrong guess
 * moves the interface under the user for no reason.
 */
export function matchIntent(rawTranscript: string): VoiceIntent | null {
  const text = normalise(rawTranscript);
  if (!text) return null;

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
    }
  }

  switch (intent.kind) {
    case "open":
      return `Opening ${moduleLabel}`;
    case "rotate":
      return intent.direction === "left" ? "Left" : "Right";
    case "close":
      return "Closing";
  }
}
