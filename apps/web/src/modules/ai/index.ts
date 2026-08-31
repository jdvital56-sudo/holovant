import type { ModuleDefinition } from "@holovant/module-contracts";
import type { CardsAi } from "@/app/api/cards/route";
import { createCardProvider } from "@/lib/createCardProvider";

/**
 * What is actually answering, and through what.
 *
 * The card used to read "idle" whether a model was configured or not, and
 * "voice: not connected yet" whether Piper was running or not. Idle reads as
 * resting; a missing key is not resting, it is absent, and the two want
 * different things from whoever is looking.
 */
export type AiSnapshot = CardsAi;

const UNKNOWN = "—";

export const aiModule: ModuleDefinition<AiSnapshot> = {
  id: "ai",
  label: "AI",
  tagline: "Knowledge & reasoning",
  themeColor: "#54c8dd",
  dataProvider: createCardProvider<AiSnapshot>("ai", {
    model: null,
    configured: false,
    voice: "browser",
    searchConfigured: false,
  }),
  toMetrics: (d) => [
    { label: "Модель", value: d.configured ? (d.model ?? "настроена") : "не настроена — нет ключа" },
    { label: "Голос", value: d.voice === "piper" ? "свой, на сервере" : "браузерный" },
    { label: "Поиск", value: d.searchConfigured ? "подключён" : "нет ключа" },
    { label: "Заметки", value: d.configured ? "читает ваши" : UNKNOWN },
  ],
  toAdvice: (d, lang) => {
    if (!d.configured) {
      const tips =
        lang === "ru"
          ? ["Модель не настроена — отвечать нечем", "Впишите ключ, и ассистент заговорит"]
          : ["No model configured — nothing can answer", "Add a key and the assistant starts working"];
      return { spoken: tips[0], tips };
    }
    const tips =
      lang === "ru"
        ? [
            `Отвечает ${d.model ?? "модель"}, голос ${d.voice === "piper" ? "свой" : "браузерный"}`,
            d.searchConfigured
              ? "Поиск подключён — про сегодняшнее спрашивайте смело"
              : "Поиск не подключён: про сегодняшнее ответить будет нечем",
            d.voice === "piper" ? "Голос свой, звучит одинаково на любой машине" : "Голос браузерный — на другой машине зазвучит иначе",
          ]
        : [
            `${d.model ?? "The model"} is answering, voice is ${d.voice}`,
            d.searchConfigured ? "Search is connected — ask about today" : "No search key: today is out of reach",
            d.voice === "piper" ? "Its own voice, the same on any machine" : "Browser voice — it differs per machine",
          ];
    return { spoken: tips[0], tips };
  },
};
