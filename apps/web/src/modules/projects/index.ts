import type { ModuleDefinition } from "@holovant/module-contracts";
import type { CardsProjects } from "@/app/api/cards/route";
import { createCardProvider } from "@/lib/createCardProvider";
import { pluralRu } from "@/voice/russianNumbers";

/**
 * The repositories he works in, most recently touched first.
 *
 * The card used to say five active projects and "Holovant" to everyone who
 * opened it. What it answers now is the question a glance at it actually asks:
 * what was I in the middle of, and what did I leave uncommitted.
 */
export type ProjectsSnapshot = CardsProjects;

const UNKNOWN = "—";

export const projectsModule: ModuleDefinition<ProjectsSnapshot> = {
  id: "projects",
  label: "Projects",
  tagline: "Active builds",
  themeColor: "#5fa1ec",
  dataProvider: createCardProvider<ProjectsSnapshot>("projects", {
    state: "not-connected",
    count: null,
    repos: [],
  }),
  toMetrics: (d) => {
    if (d.state !== "ok" || d.count === null) {
      return [
        { label: "Проекты", value: "папка не указана" },
        { label: "В работе", value: UNKNOWN },
      ];
    }
    if (d.count === 0) {
      return [
        { label: "Проекты", value: "ни одного не найдено" },
        { label: "В работе", value: UNKNOWN },
      ];
    }
    const [latest] = d.repos;
    const dirty = d.repos.filter((repo) => (repo.uncommitted ?? 0) > 0).length;
    return [
      { label: pluralRu(d.count, ["Проект", "Проекта", "Проектов"]), value: `${d.count}` },
      { label: "Последний", value: `${latest.name} — ${latest.age}` },
      { label: "Ветка", value: latest.branch ?? UNKNOWN },
      { label: "Незакоммичено", value: dirty === 0 ? "везде чисто" : `${latest.uncommitted ?? 0} в ${latest.name}` },
    ];
  },
  toAdvice: (d, lang) => {
    if (d.state !== "ok" || d.count === null) {
      const tips =
        lang === "ru"
          ? ["Папка с проектами не указана", "Укажите её, и здесь появятся ваши репозитории"]
          : ["No projects folder set", "Point the app at one and your repositories appear here"];
      return { spoken: tips[0], tips };
    }
    if (d.count === 0) {
      const tips =
        lang === "ru"
          ? ["В указанной папке репозиториев нет", "Проверьте путь — внутри должны лежать сами проекты"]
          : ["No repositories in that folder", "Check the path — the projects should sit directly inside"];
      return { spoken: tips[0], tips };
    }

    const [latest] = d.repos;
    const dirty = d.repos.filter((repo) => (repo.uncommitted ?? 0) > 0);
    const stale = d.repos.filter((repo) => /месяц|дней|дня/.test(repo.age));
    const tips =
      lang === "ru"
        ? [
            `${d.count}, последний — ${latest.name}, ${latest.age}`,
            dirty.length
              ? `Незакоммичено в ${dirty.map((r) => r.name).join(", ")} — это потеряется при переустановке`
              : "Везде закоммичено",
            stale.length ? `Давно не трогали: ${stale.map((r) => r.name).join(", ")}` : "Все в работе на этой неделе",
          ]
        : [
            `${d.count}, latest is ${latest.name}, ${latest.age}`,
            dirty.length ? `Uncommitted in ${dirty.map((r) => r.name).join(", ")}` : "Everything is committed",
            stale.length ? `Untouched lately: ${stale.map((r) => r.name).join(", ")}` : "All active this week",
          ];
    return { spoken: `${tips[0]}. ${tips[1]}`, tips };
  },
};
