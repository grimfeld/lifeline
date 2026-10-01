import type { CommandDef } from "@lifeline/core";
import { FolderKanban, ChartGantt, Plus } from "lucide-react";
import { ProjectDialog } from "./components/ProjectDialog";
import { PROJECTS_HOME } from "./domain/types";

function NewProjectCommandDialog(props: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return <ProjectDialog {...props} />;
}

// Making a Project is deliberate, not seconds: no capture Command (ADR 0060).
export const projectCommands: CommandDef[] = [
  { id: "projects.new", title: "New project…", keywords: ["project", "outcome", "plan", "goal"], icon: Plus, dialog: NewProjectCommandDialog },
  { id: "projects.open", title: "Go to Projects", keywords: ["projects", "board", "kanban"], icon: FolderKanban, run: ({ navigate }) => navigate(PROJECTS_HOME) },
  { id: "projects.timeline", title: "Go to project timeline", keywords: ["projects", "timeline", "gantt", "deadlines"], icon: ChartGantt, run: ({ navigate }) => navigate("/app/projects/timeline") },
];
