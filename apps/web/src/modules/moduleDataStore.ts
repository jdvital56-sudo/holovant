import { create } from "zustand";
import type { ModuleId, ModuleMetric } from "@holovant/module-contracts";
import { moduleRegistry } from "./registry";

interface ModuleDataState {
  metrics: Partial<Record<ModuleId, ModuleMetric[]>>;
  /** How many accounts each module has connected; absent means none. */
  accountCounts: Partial<Record<ModuleId, number>>;
  loaded: boolean;
}

export const useModuleDataStore = create<ModuleDataState>(() => ({
  metrics: {},
  accountCounts: {},
  loaded: false,
}));

let started = false;

/**
 * Reads every module's snapshot once and keeps the projected rows.
 *
 * Awaits each provider even though today's mocks are synchronous: the contract
 * allows a Promise, so a live provider arriving in Phase 3 needs no change
 * here — and card faces would otherwise start rendering blank the day one does.
 */
export function loadAllModuleData() {
  if (started) return;
  started = true;

  void Promise.all(
    moduleRegistry.map(async (module) => {
      try {
        const snapshot = await module.dataProvider.getSnapshot();
        const accounts = (await module.dataProvider.listAccounts?.()) ?? [];
        return { id: module.id, metrics: module.toMetrics(snapshot), count: accounts.length };
      } catch {
        // One failing provider must not blank out every other card.
        return { id: module.id, metrics: [] as ModuleMetric[], count: 0 };
      }
    }),
  ).then((results) => {
    useModuleDataStore.setState({
      metrics: Object.fromEntries(results.map((r) => [r.id, r.metrics])) as Partial<
        Record<ModuleId, ModuleMetric[]>
      >,
      accountCounts: Object.fromEntries(results.map((r) => [r.id, r.count])) as Partial<
        Record<ModuleId, number>
      >,
      loaded: true,
    });
  });
}

export function useModuleMetrics(id: ModuleId): ModuleMetric[] {
  return useModuleDataStore((s) => s.metrics[id]) ?? [];
}

export function useModuleAccountCount(id: ModuleId): number {
  return useModuleDataStore((s) => s.accountCounts[id]) ?? 0;
}
