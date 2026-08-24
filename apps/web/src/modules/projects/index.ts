import type { ModuleDefinition } from "@holovant/module-contracts";
import { createMockProvider } from "@/lib/createMockProvider";

export interface ProjectsSnapshot {
  activeCount: number;
  latestProject: string;
}

export const projectsModule: ModuleDefinition<ProjectsSnapshot> = {
  id: "projects",
  label: "Projects",
  tagline: "Active builds",
  themeColor: "#5fa1ec",
  dataProvider: createMockProvider<ProjectsSnapshot>({
    activeCount: 5,
    latestProject: "Holovant",
  }),
  toMetrics: (d) => [
    { label: "Active projects", value: `${d.activeCount}` },
    { label: "Latest", value: d.latestProject },
  ],
  toAdvice: (d, lang) => {
    const stretched = d.activeCount > 3;
    const tips =
      lang === "ru"
        ? [
            `${d.activeCount} проектов в работе, последний — ${d.latestProject}`,
            stretched
              ? "Больше трёх параллельно — внимание размывается, часть стоит заморозить"
              : "Нагрузка посильная",
            `Начните день с ${d.latestProject} — он свежее всего в голове`,
          ]
        : [
            `${d.activeCount} active projects, most recent is ${d.latestProject}`,
            stretched
              ? "More than three in parallel splits attention — consider pausing some"
              : "The load is manageable",
            `Start the day on ${d.latestProject} — it is freshest in mind`,
          ];
    return { spoken: `${tips[0]}. ${tips[1]}`, tips };
  },
};
