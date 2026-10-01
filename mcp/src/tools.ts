import { z, type ZodRawShape, type ZodTypeAny } from "zod";
import { isInvocable, type CommandArg, type CommandDef } from "@lifeline/core";
import { manifests } from "./apps";

/**
 * The tool catalogue an agent sees (ADR 0062). Declared here, on the main
 * thread, so `tools/list` needs no Account; run in the Account's device
 * worker (see handlers.ts), which holds the data.
 *
 * Two kinds:
 *  - generic tools over Core — Documents, the agenda, the Schedulable and
 *    Timed Contracts — that work for every App at once;
 *  - one tool per headless Command (a Command with `args` and `invoke`),
 *    so creating a Task or a Chore runs the App's own operation.
 */

export interface ToolSpec {
  name: string;
  title: string;
  description: string;
  input: ZodRawShape;
  /** Needs the lifeline:write scope; hidden from read-only connections. */
  write: boolean;
  /** For command tools: the Command id it runs. */
  command?: string;
}

const date = () => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
const time = () => z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:MM");
const workspace = z
  .string()
  .optional()
  .describe("Workspace id or name. Omit for the default Workspace. A separated Workspace sees only its own Documents.");

const GENERIC: ToolSpec[] = [
  {
    name: "list_workspaces",
    title: "List Workspaces",
    description: "The Account's Workspaces. Documents live in the shared content or inside one separated Workspace; every other tool reads and writes one Workspace at a time.",
    input: {},
    write: false,
  },
  {
    name: "list_types",
    title: "List Document types",
    description:
      "Every Document type (Task, Event, Note, Chore…) with its fields. `creatable` says whether create_document may make one; App-owned types are created through their own tools (tasks_add, calendar_add_event…). Guarded fields can only change through the App.",
    input: { type: z.string().optional().describe("One type id, for its full field list.") },
    write: false,
  },
  {
    name: "search_documents",
    title: "Search Documents",
    description: "Find Documents by text (title, body and text fields), type, tag or folder. Returns summaries; use get_document for one in full.",
    input: {
      query: z.string().optional().describe("Words that must all appear, case-insensitive."),
      type: z.string().optional().describe("Type id, e.g. task, event, note."),
      tag: z.string().optional(),
      folder: z.string().optional().describe("Folder path; includes sub-folders."),
      limit: z.number().int().min(1).max(100).optional().describe("Default 20."),
      workspace,
    },
    write: false,
  },
  {
    name: "get_document",
    title: "Get a Document",
    description: "One Document in full: fields, tags, folder and markdown body.",
    input: { id: z.string(), workspace },
    write: false,
  },
  {
    name: "agenda",
    title: "Agenda",
    description:
      "What is on each day in a range: Timed items (events, deadlines, time blocks) and Schedulable items (tasks, chores…) with their urgency and whether they are done. Overdue items are included whatever the range. Use the `appId` and `itemId` it returns with complete_item, move_item and reschedule_timed.",
    input: {
      start: date().optional().describe("First day, YYYY-MM-DD. Default: today."),
      end: date().optional().describe("Last day, inclusive. Default: start + 6 days. At most 62 days."),
      blocks: z.boolean().optional().describe("Include Time blocker bands (sleep, work hours…). Default false."),
      workspace,
    },
    write: false,
  },
  {
    name: "complete_item",
    title: "Complete an item",
    description: "Tick off a Schedulable item from the agenda (a task, a chore occurrence…). The owning App decides what completing means.",
    input: { appId: z.string(), itemId: z.string(), on: date().optional().describe("Day it was done. Default: today."), workspace },
    write: true,
  },
  {
    name: "move_item",
    title: "Move an item to another day",
    description: "Move a Schedulable item (task) or a Timed item (event) to another day. For a Schedulable item, `to` may be null to put it back in the unplanned pool.",
    input: { appId: z.string(), itemId: z.string(), to: date().nullable(), workspace },
    write: true,
  },
  {
    name: "reschedule_timed",
    title: "Reschedule a timed item",
    description: "Give a Timed item (an event, a one-off time block) a new day and time. Omit start and end to make it all day.",
    input: { appId: z.string(), itemId: z.string(), date: date(), start: time().optional(), end: time().optional(), workspace },
    write: true,
  },
  {
    name: "create_document",
    title: "Create a Document",
    description:
      "Create a Document of a body-first type (note, clipping, writing…) or a user-defined type. App-owned types such as tasks and events have their own tools; list_types says which types this accepts.",
    input: {
      type: z.string(),
      title: z.string(),
      body: z.string().optional().describe("Markdown. Omit to start from the type's template."),
      folder: z.string().optional(),
      tags: z.array(z.string()).optional(),
      fields: z.record(z.string(), z.unknown()).optional().describe("Type fields by key (see list_types). Guarded fields are refused."),
      workspace,
    },
    write: true,
  },
  {
    name: "update_document",
    title: "Update a Document",
    description:
      "Change a Document's title, body, tags, folder or plain fields. A rename rewrites [[links]] to it. Guarded fields (status, completion…) are refused: use the App's tools.",
    input: {
      id: z.string(),
      title: z.string().optional(),
      body: z.string().optional().describe("Replaces the whole markdown body."),
      tags: z.array(z.string()).optional().describe("Replaces the explicit tags."),
      folder: z.string().optional(),
      fields: z.record(z.string(), z.unknown()).optional().describe("Fields to set; null clears one."),
      workspace,
    },
    write: true,
  },
];

/** "calendar.add-event" → "calendar_add_event": MCP tool names allow [a-zA-Z0-9_-]. */
export function commandToolName(id: string): string {
  return id.replace(/[^a-zA-Z0-9]+/g, "_");
}

function argSchema(arg: CommandArg): ZodTypeAny {
  let s: ZodTypeAny;
  switch (arg.kind) {
    case "number":
      s = z.number();
      break;
    case "boolean":
      s = z.boolean();
      break;
    case "date":
      s = date();
      break;
    case "time":
      s = time();
      break;
    case "select":
      s = arg.options?.length ? z.enum(arg.options.map((o) => o.value) as [string, ...string[]]) : z.string();
      break;
    case "multiselect":
      s = z.array(arg.options?.length ? z.enum(arg.options.map((o) => o.value) as [string, ...string[]]) : z.string());
      break;
    case "list":
      s = z.array(z.string());
      break;
    case "json":
      s = z.record(z.string(), z.unknown());
      break;
    default:
      s = z.string();
  }
  const about = [arg.label, arg.hint].filter(Boolean).join(". ");
  s = s.describe(about);
  return arg.required ? s : s.optional();
}

function commandTool(def: CommandDef & { appId: string }): ToolSpec | null {
  if (!isInvocable(def)) return null;
  const input: Record<string, ZodTypeAny> = { workspace };
  for (const a of def.args) input[a.key] = argSchema(a);
  return {
    name: commandToolName(def.id),
    title: def.title,
    description: `${def.title} — the ${def.appId} App's own operation, as its "${def.title}" command does.`,
    input,
    write: true,
    command: def.id,
  };
}

/** Every tool, generic first. Built once: the App registry is fixed at compile time (ADR 0003). */
export const TOOLS: ToolSpec[] = [
  ...GENERIC,
  ...manifests.flatMap((m) => m.commands.map((c) => commandTool({ ...c, appId: m.id }))).filter((t): t is ToolSpec => t !== null),
];
