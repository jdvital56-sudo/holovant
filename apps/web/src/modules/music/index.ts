import type { ModuleDefinition } from "@holovant/module-contracts";
import { usePlaylistStore } from "@/voice/playlistStore";
import { usePlayStore } from "@/voice/playMusic";

export interface MusicSnapshot {
  nowPlaying: string;
  isPlaying: boolean;
  /** Names and sizes of the user's own collections. */
  collections: Array<{ name: string; count: number }>;
  savedTotal: number;
}

/**
 * Music reads the real player and the user's real collections.
 *
 * It used to show a fixed sample, so opening it after saving tracks showed
 * nothing saved — which looked exactly like the saving had failed.
 */
export const musicModule: ModuleDefinition<MusicSnapshot> = {
  id: "music",
  label: "Music",
  tagline: "Now playing",
  themeColor: "#50d5cf",
  dataProvider: {
    getSnapshot: () => {
      // Reading a store outside React is deliberate: the provider contract is
      // plain async, and this is the same data the panel would subscribe to.
      const play = usePlayStore.getState();
      const lists = usePlaylistStore.getState().playlists;
      return {
        nowPlaying: play.title ?? "—",
        isPlaying: play.status === "ready" && !play.paused,
        collections: lists.map((l) => ({ name: l.name, count: l.tracks.length })),
        savedTotal: lists.reduce((sum, l) => sum + l.tracks.length, 0),
      };
    },
  },
  toMetrics: (d) => [
    { label: "Now playing", value: d.nowPlaying },
    { label: "State", value: d.isPlaying ? "playing" : "paused" },
    { label: "Saved", value: String(d.savedTotal) },
  ],
  toAdvice: (d, lang) => {
    const ru = lang === "ru";
    const tips: string[] = [];

    tips.push(
      d.isPlaying
        ? ru
          ? `Играет: ${d.nowPlaying}`
          : `Playing: ${d.nowPlaying}`
        : ru
          ? "Сейчас ничего не играет"
          : "Nothing playing right now",
    );

    if (d.collections.length) {
      tips.push(
        ru
          ? `Ваши подборки: ${d.collections.map((c) => `${c.name} — ${c.count}`).join(", ")}`
          : `Your collections: ${d.collections.map((c) => `${c.name} — ${c.count}`).join(", ")}`,
      );
      tips.push(
        ru
          ? "Скажите «включи подборку» и название"
          : "Say “play the collection” and its name",
      );
    } else {
      tips.push(
        ru
          ? "Подборок пока нет — скажите «сохрани в подборку для работы», когда что-то играет"
          : "No collections yet — say “save to a collection” while something plays",
      );
    }

    tips.push(
      ru
        ? "Скажите «включи» и название — найду трек и открою его"
        : "Say “play” and a title — I will find the track and open it",
    );

    return { spoken: `${tips[0]}. ${tips[1]}`, tips };
  },
};
