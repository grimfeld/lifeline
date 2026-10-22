import type { AppManifest } from "@lifeline/core";
import { ChartGantt, FolderKanban } from "lucide-react";
import { ProjectScreen } from "./screens/ProjectScreen";
import { TimelineScreen } from "./screens/TimelineScreen";
import { ActiveProjectsCard, BoardCard, ProjectCard, useProjectOptions, useProjectTitle } from "./cards/ProjectCards";
import { projectCommands } from "./commands";
import { projectsTimed } from "./timed";
import { projectsDaylog } from "./daylog";
import { useOfferFinish } from "./background";
import { APP_ID, PROJECT, PROJECT_LANE, PROJECT_MILESTONE, PROJECTS_HOME } from "./domain/types";
import { laneType, milestoneType, projectType } from "./types";
import { ProjectPeek } from "./components/ProjectPeek";

/**
 * The Projects App (ADR 0060): Projects, their Milestones and the Lanes of
 * their Boards. Shelved with the Tasks App in the Projects Module — whose id
 * stays "tasks", since Workspaces and Phone bars already name it. The Tasks
 * App owns the Task; this App asks it to place, tick and release Tasks.
 */
export const projectsApp: AppManifest = {
  id: APP_ID,
  module: "tasks",
  title: "Projects",
  icon: FolderKanban,
  color: "var(--chart-violet)",
  // The Peek is the one part of a type that is a view: attached here, so the types stay importable without React.
  types: [{ ...projectType, peekEdit: ProjectPeek }, milestoneType, laneType],
  screens: [
    { id: "projects.timeline", title: "Timeline", path: "projects/timeline", icon: ChartGantt, component: TimelineScreen },
    { id: "projects.detail", title: "Project", path: "projects/p/:id", component: ProjectScreen, hidden: true },
  ],
  cards: [
    {
      id: "projects.active",
      title: "Active projects",
      description: "Every active project: progress, deadline and its next task",
      component: ActiveProjectsCard,
      defaultSize: { w: 4, h: 6 },
      minSize: { w: 3, h: 3 },
    },
    {
      id: "projects.project",
      title: "Project",
      description: "One project: its outcome and each milestone's progress",
      component: ProjectCard,
      defaultSize: { w: 4, h: 5 },
      minSize: { w: 3, h: 3 },
      settings: { project: { kind: "entity", label: "Project", required: true, useOptions: useProjectOptions } },
      instanceTitle: (s) => useProjectTitle(s.project),
    },
    {
      id: "projects.board",
      title: "Project board",
      description: "One project's board, compact — drag tasks between its lanes",
      component: BoardCard,
      defaultSize: { w: 8, h: 6 },
      minSize: { w: 4, h: 4 },
      settings: { project: { kind: "entity", label: "Project", required: true, useOptions: useProjectOptions } },
      instanceTitle: (s) => {
        const t = useProjectTitle(s.project);
        return t ? `${t} · Board` : "";
      },
    },
  ],
  commands: projectCommands,
  timed: projectsTimed,
  daylog: projectsDaylog,
  useBackground: useOfferFinish,
};

export { PROJECT, PROJECT_MILESTONE, PROJECT_LANE, PROJECTS_HOME };
export { ProjectsHome } from "./screens/ProjectsHome";
/** Name a Milestone or Lane of one Project by id or title (lives in the Tasks App's data, which both Apps reach). */
export { resolveInProject } from "@lifeline/app-tasks/data";
