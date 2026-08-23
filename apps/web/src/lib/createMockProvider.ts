import type { ModuleDataProvider } from "@holovant/module-contracts";

/**
 * Wraps a static snapshot as a ModuleDataProvider. Phase 3 swaps this for a
 * provider that fetches/streams from a real API — callers never change.
 */
export function createMockProvider<TData>(snapshot: TData): ModuleDataProvider<TData> {
  return {
    getSnapshot: () => snapshot,
  };
}
