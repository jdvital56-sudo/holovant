import type { ModuleDefinition } from "@holovant/module-contracts";
import { createMockProvider } from "@/lib/createMockProvider";

export interface AiSnapshot {
  status: "idle" | "listening" | "thinking" | "speaking";
}

export const aiModule: ModuleDefinition<AiSnapshot> = {
  id: "ai",
  label: "AI",
  tagline: "Knowledge & reasoning",
  themeColor: "#54c8dd",
  dataProvider: createMockProvider<AiSnapshot>({
    status: "idle",
  }),
  toMetrics: (d) => [
    { label: "Assistant status", value: d.status },
    { label: "Voice", value: "not connected yet" },
  ],
};
