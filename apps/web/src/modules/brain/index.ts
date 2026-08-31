import type { ModuleDefinition } from "@holovant/module-contracts";
import type { CardsBrain } from "@/app/api/cards/route";
import { createCardProvider } from "@/lib/createCardProvider";
import { pluralRu } from "@/voice/russianNumbers";

/**
 * The customer's own knowledge, connected as a folder of notes.
 *
 * Ships empty on purpose: the product provides the socket, and whoever buys it
 * plugs their own knowledge into it. It used to report zero notes when nothing
 * was connected, which reads as an empty vault rather than as no vault — and
 * those two want opposite things from whoever is looking.
 */
export type BrainSnapshot = CardsBrain;

const UNKNOWN = "—";

export const brainModule: ModuleDefinition<BrainSnapshot> = {
  id: "brain",
  label: "Second Brain",
  tagline: "Your own knowledge",
  themeColor: "#a978ff",
  dataProvider: createCardProvider<BrainSnapshot>("brain", {
    state: "not-connected",
    noteCount: null,
    recent: [],
  }),
  toMetrics: (d) => {
    if (d.state !== "ok" || d.noteCount === null) {
      return [
        { label: "Хранилище", value: "не подключено" },
        { label: "Заметки", value: UNKNOWN },
      ];
    }
    return [
      // The label sits under the number on the card, so it has to agree with
      // it: "82 заметки", not "82 заметок". Said aloud, the wrong form is the
      // difference between a product and a toy.
      { label: pluralRu(d.noteCount, ["Заметка", "Заметки", "Заметок"]), value: `${d.noteCount}` },
      { label: "Последнее", value: d.recent[0] ?? "ничего не менялось" },
      { label: "До этого", value: d.recent.slice(1).join(", ") || UNKNOWN },
    ];
  },
  toAdvice: (d, lang) => {
    if (d.state !== "ok" || d.noteCount === null) {
      const tips =
        lang === "ru"
          ? ["Хранилище заметок не подключено", "Укажите папку с заметками, и она появится здесь"]
          : ["No notes folder connected", "Point the app at one and it fills itself in"];
      return { spoken: tips[0], tips };
    }
    const tips =
      lang === "ru"
        ? [
            `${d.noteCount} заметок, последняя — ${d.recent[0] ?? "неизвестно"}`,
            "Спросите вслух — ответы берутся отсюда прежде, чем из общих знаний",
          ]
        : [
            `${d.noteCount} notes, most recent is ${d.recent[0] ?? "unknown"}`,
            "Ask out loud — answers come from here before general knowledge",
          ];
    return { spoken: tips[0], tips };
  },
};
