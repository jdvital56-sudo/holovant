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
};
