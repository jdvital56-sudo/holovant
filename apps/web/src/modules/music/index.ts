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
};
