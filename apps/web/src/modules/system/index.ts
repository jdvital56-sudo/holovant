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
};
