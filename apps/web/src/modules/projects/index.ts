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
  themeColor: "#8b7bff",
  dataProvider: createMockProvider<ProjectsSnapshot>({
    activeCount: 5,
    latestProject: "Holovant",
  }),
};
