import type { ModuleId } from "@holovant/module-contracts";

/**
 * Which modules exist, as plain data.
 *
 * The full registry pulls in every module's provider, and some of those now
 * read live browser state — the player, the saved collections. That is right
 * for the interface and wrong for an API route, which would drag the whole
 * client into the server bundle to check a name against a list.
 *
 * Kept beside the registry, and held to it by a test, so the two cannot drift.
 */
export const MODULE_CATALOG: ReadonlyArray<{ id: ModuleId; label: string }> = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "youtube", label: "YouTube" },
  { id: "x", label: "X" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "telegram", label: "Telegram" },
  { id: "stocks", label: "Rates" },
  { id: "projects", label: "Projects" },
  { id: "sports", label: "Sports" },
  { id: "calendar", label: "Calendar" },
  { id: "weather", label: "Weather" },
  { id: "ai", label: "AI" },
  { id: "brain", label: "Second Brain" },
  { id: "news", label: "News" },
  { id: "music", label: "Music" },
  { id: "system", label: "System" },
];

export const MODULE_IDS: ModuleId[] = MODULE_CATALOG.map((m) => m.id);

export function isModuleLabel(label: string): boolean {
  return MODULE_CATALOG.some((m) => m.label === label);
}
