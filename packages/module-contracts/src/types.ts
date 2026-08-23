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

/** One readout row in a module's expanded panel. */
export interface ModuleMetric {
  label: string;
  value: string;
  /** Signed change over the module's own reporting period, if it has one. */
  deltaPct?: number;
}

export interface ModuleDefinition<TData = unknown> {
  id: ModuleId;
  label: string;
  /** Short line shown on the collapsed card face. */
  tagline: string;
  /** Accent hue driving card glow/border/HUD tinting for this module. */
  themeColor: string;
  dataProvider: ModuleDataProvider<TData>;
  /**
   * Projects a snapshot into the rows the expanded panel renders. Required so
   * that adding a module is a type error until it has declared what it shows —
   * a new module can never silently expand into an empty panel.
   */
  toMetrics(data: TData): ModuleMetric[];
}
