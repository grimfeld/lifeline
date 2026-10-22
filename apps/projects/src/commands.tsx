import { type CommandArg, type CommandDef, type CommandDialogProps, type DateStr } from "@lifeline/core";
import { COLOR_SLOTS } from "@lifeline/ui";
import { FolderKanban, ChartGantt, Pencil, Plus, Shuffle } from "lucide-react";
import { ProjectDialog } from "./components/ProjectDialog";
import { milestoneLaneCommands } from "./milestoneLaneCommands";
import { addProject, getProject, moveProject, updateProject, type OpenTasks } from "./data/repo";
import { PROJECT, PROJECTS_HOME, STAGES, stageLabel, type Stage } from "./domain/types";

function NewProjectCommandDialog(props: CommandDialogProps) {
  return <ProjectDialog open={props.open} onOpenChange={props.onOpenChange} />;
}

const stageOptions = STAGES.map((s) => ({ value: s.value, label: s.label }));

/** The fields a Project is made and edited by, as an agent supplies them. */
const projectFields: CommandArg[] = [
  { key: "outcome", label: "Outcome", kind: "text", hint: "One line: what finished looks like." },
  { key: "start", label: "Start", kind: "date" },
  { key: "deadline", label: "Deadline", kind: "date" },
  { key: "emoji", label: "Emoji", kind: "text", hint: "The Project's face; one emoji." },
  { key: "color", label: "Colour", kind: "select", options: COLOR_SLOTS.map((c) => ({ value: c, label: c })) },
];

function checkDates(start: DateStr | null | undefined, deadline: DateStr | null | undefined) {
  if (start && deadline && deadline < start) throw new Error("The deadline comes before the start");
}

async function projectOf(id: unknown) {
  const p = await getProject(id as string);
  if (!p) throw new Error("Project not found");
  return p;
}

// Making a Project is deliberate, not seconds: no capture Command (ADR 0060).
export const projectCommands: CommandDef[] = [
  {
    id: "projects.new",
    title: "New project…",
    keywords: ["project", "outcome", "plan", "goal"],
    icon: Plus,
    dialog: NewProjectCommandDialog,
    args: [
      { key: "title", label: "Title", kind: "text", required: true },
      { key: "stage", label: "Stage", kind: "select", options: stageOptions, hint: "Defaults to Planned." },
      ...projectFields,
    ],
    returnsDocument: true,
    async invoke(a) {
      checkDates(a.start as DateStr | undefined, a.deadline as DateStr | undefined);
      const id = await addProject({
        title: a.title as string,
        outcome: a.outcome as string | undefined,
        stage: a.stage as Stage | undefined,
        start: a.start as DateStr | undefined,
        deadline: a.deadline as DateStr | undefined,
        emoji: a.emoji as string | undefined,
        color: a.color as string | undefined,
      });
      return { id, message: `Added project “${a.title}” with To do, Doing and Done lanes` };
    },
  },
  {
    id: "projects.edit",
    title: "Edit project",
    keywords: ["project", "outcome", "deadline", "rename"],
    icon: Pencil,
    args: [
      { key: "project", label: "Project", kind: "link", linkType: PROJECT, required: true },
      { key: "title", label: "Title", kind: "text" },
      ...projectFields,
    ],
    returnsDocument: true,
    async invoke(a) {
      const p = await projectOf(a.project);
      checkDates((a.start as DateStr | undefined) ?? p.start, (a.deadline as DateStr | undefined) ?? p.deadline);
      const title = (a.title as string | undefined) ?? p.title;
      await updateProject(p, {
        title,
        outcome: a.outcome as string | undefined,
        start: a.start as DateStr | undefined,
        deadline: a.deadline as DateStr | undefined,
        emoji: a.emoji as string | undefined,
        color: a.color as string | undefined,
      });
      return { id: p.id, message: `Edited project “${title}”` };
    },
  },
  {
    id: "projects.stage",
    title: "Move project to stage",
    keywords: ["project", "stage", "finish", "drop", "pause", "activate"],
    icon: Shuffle,
    args: [
      { key: "project", label: "Project", kind: "link", linkType: PROJECT, required: true },
      { key: "stage", label: "Stage", kind: "select", options: stageOptions, required: true },
      {
        key: "openTasks",
        label: "Open tasks",
        kind: "select",
        options: [
          { value: "leave", label: "Leave them open" },
          { value: "archive", label: "Archive them" },
          { value: "loose", label: "Keep as loose tasks" },
        ],
        hint: "Required to finish (done) or drop a Project that still has open Tasks: leave them where they stand, archive them, or take them out of the Project as loose Tasks.",
      },
    ],
    returnsDocument: true,
    async invoke(a) {
      const p = await projectOf(a.project);
      const stage = a.stage as Stage;
      await moveProject(p.id, stage, a.openTasks as OpenTasks | undefined);
      return { id: p.id, message: `${p.title} → ${stageLabel(stage)}` };
    },
  },
  { id: "projects.open", title: "Go to Projects", keywords: ["projects", "board", "kanban"], icon: FolderKanban, run: ({ navigate }) => navigate(PROJECTS_HOME) },
  { id: "projects.timeline", title: "Go to project timeline", keywords: ["projects", "timeline", "gantt", "deadlines"], icon: ChartGantt, run: ({ navigate }) => navigate("/app/projects/timeline") },
  ...milestoneLaneCommands,
];
