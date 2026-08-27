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
  | "brain"
  | "news"
  | "music"
  | "system";

/**
 * Source of truth for a module's data, live or mock. Phase 1 ships mock
 * implementations only; Phase 3 swaps in live providers behind this same
 * interface without touching orbit/card rendering code.
 */
/**
 * One connected account inside a module. Someone running ten Instagram
 * profiles has ten of these under a single Instagram module, rather than ten
 * modules cluttering the ring.
 */
export interface ModuleAccount<TData = unknown> {
  /** Stable across reloads; used to remember which account was selected. */
  id: string;
  /** What the user calls it — a handle or channel name. */
  label: string;
  data: TData;
}

export interface ModuleDataProvider<TData> {
  /**
   * The module's headline figures. Where several accounts are connected this
   * is their combined position, since "how am I doing overall" is the question
   * a wall of separate cards fails to answer.
   */
  getSnapshot(): Promise<TData> | TData;
  /**
   * Present only on modules that can hold more than one account. Weather and
   * system diagnostics have nothing to list, and should not have to pretend.
   */
  listAccounts?(): Promise<ModuleAccount<TData>[]> | ModuleAccount<TData>[];
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

export type AdviceLang = "ru" | "en";

/**
 * What a module tells the user to do about its own numbers. A readout leaves
 * the user to work out what a figure means; this is the part that makes the
 * module worth opening.
 */
export interface ModuleAdvice {
  /** One sentence, said aloud when the module opens. */
  spoken: string;
  /** Short actionable lines shown in the panel. */
  tips: string[];
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
  /**
   * Required for the same reason as toMetrics: a module that cannot say what
   * its numbers mean should not be addable. Rules today, and the seam an AI
   * advisor plugs into later without the callers changing.
   */
  toAdvice(data: TData, lang: AdviceLang): ModuleAdvice;
}
