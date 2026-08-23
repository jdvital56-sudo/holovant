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
  themeColor: "#8b7bff",
  dataProvider: createMockProvider<MusicSnapshot>({
    nowPlaying: "—",
    isPlaying: false,
  }),
};
