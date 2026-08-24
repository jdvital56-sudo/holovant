import type { AdviceLang, ModuleAdvice, ModuleDefinition } from "@holovant/module-contracts";
import { moduleRegistry } from "./registry";
import { loadWeather } from "./weather/weatherStore";
import { spokenWeather, adviceFor } from "./weather/advice";

/**
 * What a module has to say when it opens. Every module gives advice from its
 * own snapshot; weather additionally replaces its mock reading with a live
 * one first, since a forecast that is not today's is worse than none.
 */
export async function briefingFor(
  module: ModuleDefinition,
  lang: AdviceLang,
): Promise<ModuleAdvice> {
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
