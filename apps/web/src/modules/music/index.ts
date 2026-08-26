import type { ModuleDefinition } from "@holovant/module-contracts";
import { createMockProvider } from "@/lib/createMockProvider";

export interface MusicSnapshot {
  nowPlaying: string;
  isPlaying: boolean;
}

export const musicModule: ModuleDefinition<MusicSnapshot> = {
  id: "music",
  label: "Music",
  tagline: "Now playing",
  themeColor: "#50d5cf",
  dataProvider: createMockProvider<MusicSnapshot>({
    nowPlaying: "—",
    isPlaying: false,
  }),
  toMetrics: (d) => [
    { label: "Now playing", value: d.nowPlaying },
    { label: "State", value: d.isPlaying ? "playing" : "paused" },
  ],
  toAdvice: (d, lang) => {
    const idle = !d.isPlaying;
    const tips =
      lang === "ru"
        ? [
            idle ? "Сейчас ничего не играет" : `Играет: ${d.nowPlaying}`,
            "Скажите «включи» и название — найду трек и открою его",
            "Для работы лучше идёт инструментал — слова тянут внимание на себя",
          ]
        : [
            idle ? "Nothing playing right now" : `Playing: ${d.nowPlaying}`,
            "Say “play” and a title — I will find the track and open it",
            "Instrumental works better for focus — lyrics compete for attention",
          ];
    return { spoken: `${tips[0]}. ${tips[1]}`, tips };
  },
};
