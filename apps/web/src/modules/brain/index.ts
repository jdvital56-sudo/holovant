import type { ModuleDefinition } from "@holovant/module-contracts";
import { createMockProvider } from "@/lib/createMockProvider";

export interface BrainSnapshot {
  connected: boolean;
  noteCount: number;
}

/**
 * The customer's own knowledge, connected as a folder of notes.
 *
 * Ships empty on purpose: the product provides the socket, and whoever buys it
 * plugs their own knowledge into it. An unconnected module says how to connect
 * one rather than showing invented contents.
 */
export const brainModule: ModuleDefinition<BrainSnapshot> = {
  id: "brain",
  label: "Second Brain",
  tagline: "Your own knowledge",
  themeColor: "#a978ff",
  dataProvider: createMockProvider<BrainSnapshot>({ connected: false, noteCount: 0 }),
  toMetrics: (d) => [
    { label: "Status", value: d.connected ? "connected" : "not connected" },
    { label: "Notes", value: d.connected ? String(d.noteCount) : "—" },
  ],
  toAdvice: (d, lang) => {
    if (!d.connected) {
      const tips =
        lang === "ru"
          ? [
              "Хранилище знаний не подключено",
              "Укажите папку с заметками в настройке HOLOVANT_BRAIN_PATH",
              "Подойдёт любая папка с файлами Markdown — например хранилище Obsidian",
            ]
          : [
              "No knowledge base is connected",
              "Point HOLOVANT_BRAIN_PATH at a folder of notes",
              "Any folder of Markdown works — an Obsidian vault, for instance",
            ];
      return { spoken: tips[0], tips };
    }

    const tips =
      lang === "ru"
        ? [
            `Подключено, ${d.noteCount} заметок`,
            "Спросите «что я знаю про …» — отвечу по вашим записям",
            "Ассистент опирается на эти заметки, когда они относятся к вопросу",
          ]
        : [
            `Connected, ${d.noteCount} notes`,
            "Ask “what do I know about …” and the answer comes from your notes",
            "The assistant draws on them whenever they bear on the question",
          ];
    return { spoken: tips[0], tips };
  },
};
