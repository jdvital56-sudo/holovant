import { create } from "zustand";
import type { ModuleId, ModuleMetric } from "@holovant/module-contracts";
import { moduleRegistry } from "./registry";

interface ModuleDataState {
  metrics: Partial<Record<ModuleId, ModuleMetric[]>>;
  loaded: boolean;
}

export const useModuleDataStore = create<ModuleDataState>(() => ({
  metrics: {},
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
        return [module.id, module.toMetrics(snapshot)] as const;
      } catch {
        // One failing provider must not blank out every other card.
        return [module.id, []] as const;
      }
    }),
  ).then((entries) => {
    useModuleDataStore.setState({
      metrics: Object.fromEntries(entries) as Partial<Record<ModuleId, ModuleMetric[]>>,
      loaded: true,
    });
  });
}

export function useModuleMetrics(id: ModuleId): ModuleMetric[] {
  return useModuleDataStore((s) => s.metrics[id]) ?? [];
}
