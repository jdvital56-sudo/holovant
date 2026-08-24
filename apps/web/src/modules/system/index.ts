import type { ModuleDefinition } from "@holovant/module-contracts";
import { createMockProvider } from "@/lib/createMockProvider";

export interface SystemSnapshot {
  cpuPct: number;
  gpuPct: number;
  memoryPct: number;
}

export const systemModule: ModuleDefinition<SystemSnapshot> = {
  id: "system",
  label: "System",
  tagline: "Diagnostics",
  themeColor: "#4ed0bf",
  dataProvider: createMockProvider<SystemSnapshot>({
    cpuPct: 18,
    gpuPct: 34,
    memoryPct: 52,
  }),
  toMetrics: (d) => [
    { label: "CPU", value: `${d.cpuPct}%` },
    { label: "GPU", value: `${d.gpuPct}%` },
    { label: "Memory", value: `${d.memoryPct}%` },
  ],
  toAdvice: (d, lang) => {
    const hot = Math.max(d.cpuPct, d.gpuPct);
    const tight = d.memoryPct >= 80;
    const tips =
      lang === "ru"
        ? [
            `CPU ${d.cpuPct}%, GPU ${d.gpuPct}%, память ${d.memoryPct}%`,
            hot >= 85
              ? "Машина под нагрузкой — тяжёлые задачи сейчас будут тормозить"
              : "Запас есть, можно грузить дальше",
            tight ? "Памяти мало — закройте лишние вкладки" : "С памятью порядок",
          ]
        : [
            `CPU ${d.cpuPct}%, GPU ${d.gpuPct}%, memory ${d.memoryPct}%`,
            hot >= 85
              ? "The machine is under load — heavy work will drag right now"
              : "Headroom available, safe to load it further",
            tight ? "Memory is tight — close spare tabs" : "Memory is fine",
          ];
    return { spoken: `${tips[0]}. ${tips[1]}`, tips };
  },
};
