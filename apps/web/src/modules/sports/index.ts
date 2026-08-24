import type { ModuleDefinition } from "@holovant/module-contracts";
import { createMockProvider } from "@/lib/createMockProvider";

export interface SportsSnapshot {
  liveFixture: string;
  score: string;
}

export const sportsModule: ModuleDefinition<SportsSnapshot> = {
  id: "sports",
  label: "Sports",
  tagline: "Live scores",
  themeColor: "#5cabe9",
  dataProvider: createMockProvider<SportsSnapshot>({
    liveFixture: "Arsenal vs Man City",
    score: "1 - 1",
  }),
  toMetrics: (d) => [
    { label: "Live fixture", value: d.liveFixture },
    { label: "Score", value: d.score },
  ],
  toAdvice: (d, lang) => {
    const [home, away] = d.score.split("-").map((part) => Number(part.trim()));
    const level = Number.isFinite(home) && Number.isFinite(away) && home === away;
    const tips =
      lang === "ru"
        ? [
            `${d.liveFixture} — ${d.score}`,
            level ? "Счёт равный, концовка решит исход — стоит посмотреть" : "Один впереди, интрига слабее",
            "Скажите «найди» с названием команды, чтобы посмотреть разбор",
          ]
        : [
            `${d.liveFixture} — ${d.score}`,
            level ? "Level score, the finish will decide it — worth watching" : "One side is ahead, less at stake",
            "Say “search for” with a team name to read the analysis",
          ];
    return { spoken: `${tips[0]}. ${tips[1]}`, tips };
  },
};
