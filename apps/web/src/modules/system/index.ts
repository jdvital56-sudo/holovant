import type { ModuleDefinition } from "@holovant/module-contracts";
import type { CardsSystem } from "@/app/api/cards/route";
import { createCardProvider } from "@/lib/createCardProvider";
import { pluralRu } from "@/voice/russianNumbers";

/**
 * This machine, measured.
 *
 * It used to show CPU 18%, GPU 34%, memory 52% — three numbers nobody took,
 * identical on every machine that ever ran it. Processor and graphics load are
 * not available to the server on Windows, so they are not shown at all: a
 * made-up load is worse than a missing one, and a dash asks a question while a
 * plausible figure answers it wrongly.
 */
export type SystemSnapshot = CardsSystem;

export const systemModule: ModuleDefinition<SystemSnapshot> = {
  id: "system",
  label: "System",
  tagline: "Diagnostics",
  themeColor: "#4ed0bf",
  dataProvider: createCardProvider<SystemSnapshot>("system", {
    platform: "—",
    cpuCount: 0,
    memoryUsedPct: 0,
    uptimeHours: 0,
  }),
  toMetrics: (d) => [
    { label: "Память", value: `${d.memoryUsedPct}%` },
    { label: pluralRu(d.cpuCount, ["Ядро", "Ядра", "Ядер"]), value: `${d.cpuCount}` },
    { label: "Система", value: d.platform },
    { label: "Аптайм", value: `${d.uptimeHours} ч` },
  ],
  toAdvice: (d, lang) => {
    const tight = d.memoryUsedPct >= 85;
    const tips =
      lang === "ru"
        ? [
            `Память занята на ${d.memoryUsedPct}%, ядер ${d.cpuCount}`,
            tight
              ? "Памяти в обрез — закройте лишнее, сцена и распознавание руки просядут первыми"
              : "Памяти достаточно",
            `Машина работает ${d.uptimeHours} ч без перезагрузки`,
          ]
        : [
            `Memory ${d.memoryUsedPct}% used, ${d.cpuCount} cores`,
            tight ? "Memory is tight — close something; the scene suffers first" : "Memory is comfortable",
            `Up for ${d.uptimeHours}h without a restart`,
          ];
    return { spoken: `${tips[0]}. ${tips[1]}`, tips };
  },
};
