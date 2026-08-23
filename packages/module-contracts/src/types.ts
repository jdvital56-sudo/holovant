export type ModuleId =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "x"
  | "linkedin"
  | "telegram"
  | "stocks"
  | "projects"
  | "sports"
  | "calendar"
  | "weather"
  | "ai"
  | "news"
  | "music"
  | "system";

/**
 * Source of truth for a module's data, live or mock. Phase 1 ships mock
 * implementations only; Phase 3 swaps in live providers behind this same
 * interface without touching orbit/card rendering code.
 */
export interface ModuleDataProvider<TData> {
  getSnapshot(): Promise<TData> | TData;
  /** Optional push channel for live data; unused by mock providers. */
  subscribe?(onUpdate: (data: TData) => void): () => void;
}

export interface ModuleDefinition<TData = unknown> {
  id: ModuleId;
  label: string;
  /** Short line shown on the collapsed card face. */
  tagline: string;
  /** Accent hue driving card glow/border/HUD tinting for this module. */
  themeColor: string;
  dataProvider: ModuleDataProvider<TData>;
}
