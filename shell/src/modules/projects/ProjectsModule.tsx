import { ChartGantt, FolderKanban, ListTodo } from "lucide-react";
import { ProjectsHome } from "@lifeline/app-projects";
import { handModule } from "../handModule";

/**
 * Projects (ADR 0060): the Projects App beside the Tasks App. It lands on the
 * Projects by stage; a Project's own page, its Board and the Timeline are the
 * Projects App's screens, and Tasks keeps its screen for the loose and the
 * dated work. The Module's id stays "tasks" — Workspaces already name it.
 */
export const projectsShell = handModule({
  id: "tasks",
  title: "Projects",
  places: [
    { key: "projects", title: "Projects", icon: FolderKanban, page: "" },
    { key: "timeline", title: "Timeline", icon: ChartGantt, screen: "projects.timeline" },
    { key: "tasks", title: "Tasks", icon: ListTodo, screen: "tasks.main" },
  ],
  pages: [{ path: "", component: ProjectsHome }],
});
