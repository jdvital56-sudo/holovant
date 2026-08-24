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
  toAdvice: (d, lang) => {
    const tips =
      lang === "ru"
        ? [
            "Скажите «найди …» — ищу в интернете голосом",
            "«открой …» открывает любой модуль, «влево»/«вправо» крутят карусель",
            `Состояние: ${d.status}`,
          ]
        : [
            "Say “search for …” and I will search the web",
            "“open …” opens any module, “left”/“right” turn the carousel",
            `Status: ${d.status}`,
          ];
    return { spoken: tips[0], tips };
  },
};
