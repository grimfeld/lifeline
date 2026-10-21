import { z, type ZodTypeAny } from "zod";
import { isInvocable, macroCommand, commandKey, type CommandArg, type CommandDef, type MacroShape, type OwnedCommand } from "@lifeline/core";
import { GUIDE_PAGES, guidePage } from "@lifeline/guide";
import { manifests } from "./apps";

/**
 * The tool catalogue an agent sees (ADR 0062). Declared here, on the main
 * thread, so `tools/list` needs no Account; run in the Account's device
 * worker (see handlers.ts), which holds the data.
 *
 * Two kinds:
 *  - generic tools over Core — Documents, the agenda, the Schedulable and
 *    Timed Contracts — that work for every App at once, and the Guide;
 *  - one tool per headless Command (a Command with `args` and `invoke`),
 *    so creating a Task or a Chore runs the App's own operation.
 *
 * And one kind that is not here: a tool per headless Macro (ADR 0092). Macros
 * are the Account's own data, so `TOOLS` cannot hold them; `macroTools` builds
 * them in the Account's device, and the server adds them per request.
 */

export interface ToolSpec {
  name: string;
  title: string;
  description: string;
  /** Classic zod types, so a field can be `.safeParse`d (ZodRawShape types them as core `$ZodType`s). */
  input: Record<string, ZodTypeAny>;
  /** Needs the lifeline:write scope; hidden from read-only connections. */
  write: boolean;
  /** For command tools: the Command id it runs. */
  command?: string;
  /** For Macro tools: the Macro id it runs. */
  macro?: string;
  /** Answered by the server itself, with no Account's data: no device runs it. */
  local?: (args: Record<string, unknown>) => unknown;
}

const date = () => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
const time = () => z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:MM");
const workspace = z
  .string()
  .optional()
  .describe("Workspace id or name. Omit for the default Workspace. A separated Workspace sees only its own Documents.");

/** The Guide (ADR 0089): its list of pages, or one page's Markdown — the very text the app shows. */
function readGuide({ page }: Record<string, unknown>): unknown {
  const pages = GUIDE_PAGES.map((p) => ({ page: p.slug, title: p.title }));
  if (page === undefined) return { pages };
  const p = guidePage(String(page));
  return p ? { page: p.slug, title: p.title, markdown: p.body } : { error: `No Guide page "${String(page)}".`, pages };
}

/** A step as an agent writes it: the stored shape, so list_macros' steps go back into update_macro unchanged. */
const stepArg = z.discriminatedUnion("from", [
  z.object({ from: z.literal("fixed"), value: z.unknown().describe("The value, as the Command's own tool takes it.") }),
  z.object({ from: z.literal("asked") }),
  z.object({ from: z.literal("step"), step: z.number().int().min(0).describe("0-based index of an earlier headless step; its Document is the value.") }),
]);
const steps = z
  .array(
    z.object({
      command: z.string().describe("The Command as appId/commandId, e.g. tasks/add (list_macros with commands: true lists them)."),
      args: z.record(z.string(), stepArg).describe("Where each argument gets its value, by the Command's argument key: fixed, asked when the Macro runs, or what an earlier step made."),
      skipIfRefused: z.boolean().optional().describe("Refused, this step is reported skipped and the Macro carries on."),
    }),
  )
  .min(1)
  .describe("The steps, in order. A step that goes somewhere comes last; a Macro is never a step.");

const GENERIC: ToolSpec[] = [
  {
    name: "guide",
    title: "Read the Guide",
    description:
      "Lifeline's own manual: what each Module, Surface and part of the app is for and how to use it, including which tools act on it. Without `page`, the list of pages; with one, that page as Markdown (links to other pages are their slug + .md). Read it to answer how-to questions about Lifeline.",
    input: { page: z.string().optional().describe("A page from the list: house, money, calendar, capture…") },
    write: false,
    local: readGuide,
  },
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
    description:
      "Give a Timed item (an event, a one-off time block) a new day and time. `endDate` is the day it ends on, for one that runs overnight or across days (omit it to end on `date`); the end must be after the start. Omit start and end to make it all day.",
    input: { appId: z.string(), itemId: z.string(), date: date(), start: time().optional(), endDate: date().optional(), end: time().optional(), workspace },
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
  {
    name: "list_macros",
    title: "List Macros",
    description:
      "The user's Macros (saved lists of Commands run as one) with their steps, whether each is broken and why, and the tool that runs it (`tool`, for a headless one). With `commands: true`, also every Command a step may name, with its arguments.",
    input: { commands: z.boolean().optional().describe("Also list the Commands a step may name. Default false."), workspace },
    write: false,
  },
  {
    name: "create_macro",
    title: "Create a Macro",
    description:
      "Save a new Macro. It is checked as strictly as in the app's editor (every Command exists, values fit, fixed links name one Document, required values have a source); a broken one is refused with the reasons and nothing is saved.",
    input: { name: z.string().trim().min(1), steps, workspace },
    write: true,
  },
  {
    name: "update_macro",
    title: "Update a Macro",
    description: "Rename a Macro or replace its steps (the whole list). Checked like create_macro; a broken result is refused and nothing changes.",
    input: { id: z.string(), name: z.string().trim().min(1).optional(), steps: steps.optional(), workspace },
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
    case "rows":
      s = z.array(z.object(Object.fromEntries((arg.of ?? []).map((a) => [a.key, argSchema(a)]))));
      break;
    default:
      s = z.string();
  }
  const about = [arg.label, arg.hint, arg.kind === "link" ? "Takes an id or the exact title" : undefined].filter(Boolean).join(". ");
  s = s.describe(about);
  return arg.required ? s : s.optional();
}

function argsInput(args: readonly CommandArg[]): Record<string, ZodTypeAny> {
  const input: Record<string, ZodTypeAny> = { workspace };
  for (const a of args) input[a.key] = argSchema(a);
  return input;
}

function commandTool(def: CommandDef & { appId: string }): ToolSpec | null {
  if (!isInvocable(def)) return null;
  const input = argsInput(def.args);
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

/** A headless Macro's tool, as the device describes it: plain data, so it crosses from the worker to the server. */
export interface MacroTool {
  name: string;
  title: string;
  description: string;
  macro: string;
  args: CommandArg[];
}

const MAX_NAME = 64;

/**
 * One tool per headless Macro (ADR 0092), named after it (`macro_coffee`) —
 * a name two Macros share, or one with no letters, takes the Macro's id. Its
 * arguments are the Macro's asked ones, keyed per step (`s1_title`).
 * Deterministic over the Macros' order, so the device finds again the tool
 * the server listed.
 */
export function macroTools(macros: readonly (MacroShape & { id: string })[], commands: readonly OwnedCommand[]): MacroTool[] {
  const made = macros.flatMap((m) => {
    const def = macroCommand(m, commands);
    if (!isInvocable(def)) return [];
    const titles = m.steps.map((s, i) => `${i + 1}. ${commands.find((c) => commandKey(c) === s.command)?.title ?? s.command}`);
    const description = `Run the user's Macro “${m.name}”: ${titles.join("; ")}. Each step goes through its App; the result reports every step (done, skipped, stopped or not reached).`;
    return [{ slug: commandToolName(m.name).toLowerCase().replace(/^_+|_+$/g, ""), tool: { title: m.name, description, macro: m.id, args: def.args } }];
  });
  const taken = new Set(TOOLS.map((t) => t.name));
  const count = new Map<string, number>();
  for (const { slug } of made) count.set(slug, (count.get(slug) ?? 0) + 1);
  return made.map(({ slug, tool }) => {
    const unique = slug && count.get(slug) === 1 && !taken.has(`macro_${slug}`);
    const name = (unique ? `macro_${slug}` : `macro_${slug ? `${slug}_` : ""}${commandToolName(tool.macro)}`).slice(0, MAX_NAME);
    return { name, ...tool };
  });
}

/** A Macro tool as the server registers it: a write tool, like every Command tool. */
export function macroToolSpec(t: MacroTool): ToolSpec {
  return { name: t.name, title: t.title, description: t.description, input: argsInput(t.args), write: true, macro: t.macro };
}
