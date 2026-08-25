import type { AdviceLang, ModuleAdvice, ModuleDefinition } from "@holovant/module-contracts";
import { moduleRegistry } from "./registry";
import { loadWeather } from "./weather/weatherStore";
import { spokenWeather, adviceFor } from "./weather/advice";
import { runSystemCheck } from "./system/systemStore";
import { systemAdvice } from "./system/report";

/**
 * What a module has to say when it opens.
 *
 * Most speak from their own snapshot. Two cannot: weather and system are about
 * conditions right now, and a made-up reading from either is worse than none —
 * a system module reporting invented load is the least defensible of all.
 */
export async function briefingFor(
  module: ModuleDefinition,
  lang: AdviceLang,
): Promise<ModuleAdvice> {
  if (module.id === "system") {
    const report = await runSystemCheck();
    return systemAdvice(report, lang);
  }

  if (module.id === "weather") {
    const live = await loadWeather();
    if (live) {
      return { spoken: spokenWeather(live, lang), tips: adviceFor(live, lang) };
    }
    // Fall through to the module's own advice when location is unavailable, so
    // opening weather still says something rather than going silent.
  }

  const snapshot = await module.dataProvider.getSnapshot();
  return module.toAdvice(snapshot, lang);
}

export function findModule(id: string): ModuleDefinition | undefined {
  return moduleRegistry.find((m) => m.id === id);
}
