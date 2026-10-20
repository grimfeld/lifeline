import {
  addDays,
  allDocuments,
  allDocumentTypes,
  allWorkspaces,
  allCommands,
  createDocument,
  db,
  defaultFolder,
  defaultWorkspace,
  diffDays,
  documentTypeSync,
  getDocument,
  inPrivateFolder,
  invokeCommand,
  isVaultType,
  moveDocument,
  moveSurfaceItem,
  normalizeFolder,
  patchDocument,
  readCommandArgs,
  renameDocument,
  schedulableProviders,
  setCurrentWorkspace,
  surfaceItemsIn,
  timedProviders,
  whenProblem,
  titleTaken,
  todayStr,
  typeFieldsOf,
  fieldsOfDocument,
  rolesOf,
  withRoleFields,
  type CommandArg,
  type Document,
  type DocumentTypeDef,
  type FieldDef,
  type Placement,
} from "@lifeline/core";
import { TOOLS } from "./tools";

/**
 * Tool handlers, run inside one Account's device worker (ADR 0062). Every
 * read goes through Core's gated store and every write through Core or the
 * owning App — the same paths a device's UI takes — so the agent can do
 * nothing a person at the app could not.
 *
 * One rule is the server's own: the Private folder is never shown to or
 * written by an agent, whether or not the user has set a password for it.
 */

type Args = Record<string, unknown>;

export class ToolError extends Error {}

const AGENDA_MAX_DAYS = 62;

// --- Workspaces ---

async function enterWorkspace(ref: unknown): Promise<void> {
  const list = await allWorkspaces();
  if (ref === undefined || ref === null || ref === "") {
    setCurrentWorkspace(defaultWorkspace(list)?.id ?? "");
    return;
  }
  const want = String(ref).trim().toLowerCase();
  const ws = list.find((w) => w.id === ref) ?? list.find((w) => w.name.trim().toLowerCase() === want);
  if (!ws) throw new ToolError(`No Workspace “${ref}”. Known: ${list.map((w) => w.name).join(", ") || "none"}`);
  setCurrentWorkspace(ws.id);
}

// --- Documents ---

function isAgentVisible(doc: Pick<Document, "folder" | "type">): boolean {
  if (inPrivateFolder(doc.folder)) return false;
  return !documentTypeSync(doc.type)?.internal;
}

/** Fields an agent may set directly: what a Base lets a person edit (ADR 0020). */
function isWritableField(f: FieldDef): boolean {
  return !f.guarded && !f.hidden && f.kind !== "json";
}

/** Whether create_document may make a Document of this type: the types the Vault creates generically, and user-defined ones. */
function isCreatable(def: DocumentTypeDef): boolean {
  return !def.internal && def.titleRule !== "derived" && (isVaultType(def) || !def.builtIn);
}

function fieldArg(f: FieldDef): CommandArg {
  const kind: CommandArg["kind"] =
    f.kind === "links" ? "list" : f.kind === "datetime" || f.kind === "url" ? "text" : f.kind === "geo" ? "json" : f.kind;
  return { key: f.key, label: f.label, kind, options: f.options, linkType: f.linkType, linkRole: f.linkRole };
}

/** Check type fields the way a Base would accept them; null clears a field. Throws on guarded or unknown keys. */
async function readFields(def: DocumentTypeDef, raw: Args): Promise<Args> {
  const byKey = new Map(def.fields.map((f) => [f.key, f]));
  for (const key of Object.keys(raw)) {
    const f = byKey.get(key);
    if (!f) throw new ToolError(`${def.label} has no field “${key}”. Fields: ${def.fields.filter(isWritableField).map((x) => x.key).join(", ")}`);
    if (!isWritableField(f)) throw new ToolError(`“${f.label}” is ${f.guarded ? "guarded: only the App's own tools change it" : "not editable directly"}`);
  }
  const clears = Object.keys(raw).filter((k) => raw[k] === null);
  for (const k of clears) if (byKey.get(k)!.required) throw new ToolError(`“${byKey.get(k)!.label}” is required`);
  const set = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== null));
  const checked = await readCommandArgs(def.fields.filter((f) => f.key in set).map(fieldArg), set).catch((e: Error) => {
    throw new ToolError(e.message);
  });
  return { ...checked, ...Object.fromEntries(clears.map((k) => [k, null])) };
}

function summary(doc: Document, query?: string) {
  const body = typeof doc.body === "string" ? doc.body : "";
  let snippet: string | undefined;
  if (body) {
    const at = query ? body.toLowerCase().indexOf(query.toLowerCase().split(/\s+/)[0]) : 0;
    const from = Math.max(0, at - 60);
    snippet = (from > 0 ? "…" : "") + body.slice(from, from + 200).replace(/\s+/g, " ").trim() + (body.length > from + 200 ? "…" : "");
  }
  return { id: doc.id, type: doc.type, title: doc.title, folder: doc.folder || undefined, tags: doc.tags.length ? doc.tags : undefined, updatedAt: doc.updatedAt, snippet };
}

function full(doc: Document) {
  const def = documentTypeSync(doc.type);
  const hidden = new Set(fieldsOfDocument(doc, def).filter((f) => f.hidden).map((f) => f.key));
  const roles = rolesOf(doc).map((r) => r.label);
  const fields = Object.fromEntries(Object.entries(typeFieldsOf(doc)).filter(([k, v]) => !hidden.has(k) && k !== "owner" && v !== undefined && v !== ""));
  return {
    id: doc.id,
    type: doc.type,
    title: doc.title,
    folder: doc.folder,
    tags: doc.tags,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    roles: roles.length ? roles : undefined,
    fields,
    body: def?.body === "none" || !doc.body ? undefined : doc.body,
  };
}

function haystack(doc: Document): string {
  const parts = [doc.title, typeof doc.body === "string" ? doc.body : ""];
  for (const v of Object.values(typeFieldsOf(doc))) if (typeof v === "string") parts.push(v);
  return parts.join("\n").toLowerCase();
}

async function visibleDocument(id: unknown): Promise<Document> {
  const doc = await getDocument(String(id));
  if (!doc || !isAgentVisible(doc)) throw new ToolError(`No Document ${id} in this Workspace`);
  return doc;
}

function assertNotPrivate(folder: string): void {
  if (inPrivateFolder(normalizeFolder(folder))) throw new ToolError("The Private folder is out of an agent's reach");
}

// --- Contracts ---

function schedulable(appId: unknown) {
  const p = schedulableProviders().find((x) => x.appId === appId);
  if (!p) throw new ToolError(`No App “${appId}” has Schedulable items`);
  return p;
}

function timed(appId: unknown) {
  return timedProviders().find((x) => x.appId === appId);
}

/** The day-only pin Core keeps for an App that owns no moves. */
async function dayPinOf(appId: string, itemId: string): Promise<string | undefined> {
  const pins = await db().collection<Placement>("placements").where("[appId+itemId]").equals([appId, itemId]).toArray();
  return pins.find((p) => !p.deleted && !p.start)?.id;
}

// --- the handlers ---

const handlers: Record<string, (a: Args) => Promise<unknown>> = {
  async list_workspaces() {
    const list = await allWorkspaces();
    const def = defaultWorkspace(list);
    return list.map((w) => ({ id: w.id, name: w.name, separated: !!w.separated, default: w.id === def?.id || undefined }));
  },

  async list_types(a) {
    const types = allDocumentTypes().filter((t) => !t.internal);
    const one = a.type ? types.find((t) => t.id === a.type) : undefined;
    if (a.type && !one) throw new ToolError(`No type “${a.type}”. Known: ${types.map((t) => t.id).join(", ")}`);
    return (one ? [one] : types).map((t) => ({
      id: t.id,
      label: t.label,
      app: t.appId,
      creatable: isCreatable(t) || undefined,
      body: t.body,
      fields: one
        ? t.fields.filter((f) => !f.hidden).map((f) => ({ key: f.key, label: f.label, kind: f.kind, options: f.options?.map((o) => o.value), guarded: f.guarded || undefined, required: f.required || undefined }))
        : t.fields.filter((f) => !f.hidden).map((f) => f.key + (f.guarded ? " (guarded)" : "")),
    }));
  },

  async search_documents(a) {
    const words = String(a.query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
    const folder = a.folder === undefined ? undefined : normalizeFolder(String(a.folder));
    const tag = a.tag === undefined ? undefined : String(a.tag).toLowerCase().replace(/^#/, "");
    const limit = Number(a.limit ?? 20);
    const hits = (await allDocuments())
      .filter(isAgentVisible)
      .filter((d) => !a.type || d.type === a.type)
      .filter((d) => !tag || d.tags.includes(tag))
      .filter((d) => folder === undefined || d.folder === folder || d.folder.startsWith(`${folder}/`))
      .filter((d) => {
        if (!words.length) return true;
        const h = haystack(d);
        return words.every((w) => h.includes(w));
      })
      .sort((x, y) => (y.updatedAt > x.updatedAt ? 1 : -1));
    return { total: hits.length, documents: hits.slice(0, limit).map((d) => summary(d, a.query as string | undefined)) };
  },

  async get_document(a) {
    return full(await visibleDocument(a.id));
  },

  async agenda(a) {
    const start = (a.start as string | undefined) ?? todayStr();
    const end = (a.end as string | undefined) ?? addDays(start, 6);
    if (end < start) throw new ToolError("end is before start");
    if (diffDays(start, end) >= AGENDA_MAX_DAYS) throw new ToolError(`At most ${AGENDA_MAX_DAYS} days at a time`);
    const range = { start, end };
    const { items, pool } = await surfaceItemsIn(range);
    const timedItems = [];
    for (const p of timedProviders()) {
      if (!p.itemsIn) continue;
      for (const it of await p.itemsIn(range)) {
        if (it.background && !a.blocks) continue;
        timedItems.push({ kind: it.background ? "block" : it.marker ? "deadline" : "event", appId: it.appId, itemId: it.itemId, title: it.title, date: it.date, start: it.start ?? undefined, end: it.end ?? undefined, subtitle: it.subtitle, tags: it.tags?.length ? it.tags : undefined });
      }
    }
    const work = items.map((it) => ({
      kind: it.start ? "time-block" : "item",
      appId: it.appId,
      itemId: it.itemId,
      title: it.title,
      date: it.displayDate,
      start: it.start ?? undefined,
      end: it.end ?? undefined,
      urgency: it.urgency === "none" ? undefined : it.urgency,
      done: it.completedOn ?? undefined,
      estimateMin: it.estimateMin ?? undefined,
      subtitle: it.subtitle,
      tags: it.tags?.length ? it.tags : undefined,
    }));
    const days: Record<string, unknown[]> = {};
    for (const x of [...timedItems, ...work].sort((p, q) => (p.date + (p.start ?? "")).localeCompare(q.date + (q.start ?? "")))) {
      (days[x.date] ??= []).push({ ...x, date: undefined });
    }
    return {
      today: todayStr(),
      range,
      days,
      unplanned: pool.filter((p) => !p.completedOn).map((p) => ({ appId: p.appId, itemId: p.itemId, title: p.title, estimateMin: p.estimateMin ?? undefined, tags: p.tags?.length ? p.tags : undefined })),
    };
  },

  async complete_item(a) {
    const on = (a.on as string | undefined) ?? todayStr();
    await schedulable(a.appId).complete(String(a.itemId), on);
    return { message: `Completed ${a.appId}/${a.itemId} on ${on}` };
  },

  async move_item(a) {
    const appId = String(a.appId);
    const itemId = String(a.itemId);
    const to = (a.to as string | null) ?? null;
    const sp = schedulableProviders().find((p) => p.appId === appId);
    if (sp) {
      if (to === null && !sp.move && !(await dayPinOf(appId, itemId))) throw new ToolError("That item has no planned day to take it off");
      await moveSurfaceItem({ appId, itemId, placementId: await dayPinOf(appId, itemId), start: null }, to);
      return { message: to ? `Moved ${appId}/${itemId} to ${to}` : `Took ${appId}/${itemId} off its day` };
    }
    const tp = timed(appId);
    if (!tp?.move) throw new ToolError(`Items of “${appId}” cannot be moved`);
    if (to === null) throw new ToolError("A timed item always has a day");
    await tp.move(itemId, to);
    return { message: `Moved ${appId}/${itemId} to ${to}` };
  },

  async reschedule_timed(a) {
    const tp = timed(a.appId);
    if (!tp?.reschedule) throw new ToolError(`Items of “${a.appId}” cannot be rescheduled`);
    const start = (a.start as string | undefined) ?? null;
    const end = (a.end as string | undefined) ?? null;
    const date = String(a.date);
    const endDate = (a.endDate as string | undefined) ?? (start ? date : undefined);
    const when = { date, start, ...(endDate ? { endDate } : {}), end };
    // The one span rule (ADR 0090), the same the Event form and the add-event Command ask.
    const problem = whenProblem(when);
    if (problem) throw new ToolError(problem);
    await tp.reschedule(String(a.itemId), when);
    const endDay = endDate && endDate !== date ? `${endDate} ` : "";
    return { message: `Rescheduled ${a.appId}/${a.itemId} to ${date}${start ? ` ${start}${end ? `–${endDay}${end}` : ""}` : " (all day)"}` };
  },

  async create_document(a) {
    const def = documentTypeSync(String(a.type));
    if (!def) throw new ToolError(`No type “${a.type}”`);
    if (!isCreatable(def)) {
      const tools = TOOLS.filter((t) => t.command?.startsWith(`${def.appId}.`)).map((t) => t.name);
      throw new ToolError(`${def.label} belong to the ${def.appId} App and are created through its own tools${tools.length ? `: ${tools.join(", ")}` : " (none can run headless yet)"}`);
    }
    // Resolve the folder the way createDocument would, and refuse Private before anything is written.
    const folder = a.folder !== undefined ? normalizeFolder(String(a.folder)) : defaultFolder(def.id, String(a.title).trim(), def.folder ?? "");
    if (inPrivateFolder(folder)) {
      throw new ToolError(a.folder !== undefined ? "The Private folder is out of an agent's reach" : "The type's default folder is Private, out of an agent's reach");
    }
    const fields = await readFields(def, (a.fields as Args | undefined) ?? {});
    // `tags` rides along with the fields: createDocument hands both to putDocument, which normalises them.
    const doc = await createDocument({
      type: def.id,
      title: String(a.title),
      folder,
      body: a.body as string | undefined,
      fields: a.tags ? { ...fields, tags: a.tags } : fields,
    }).catch((e: Error) => {
      throw new ToolError(e.message);
    });
    return { id: doc.id, message: `Created ${def.label.toLowerCase().replace(/s$/, "")} “${doc.title}”${doc.folder ? ` in ${doc.folder}` : ""}` };
  },

  async update_document(a) {
    let doc = await visibleDocument(a.id);
    const def = documentTypeSync(doc.type);
    if (!def) throw new ToolError(`Unknown type “${doc.type}”`);
    // Check everything first, so a refused field never leaves a half-applied move or rename behind.
    const move = a.folder !== undefined && normalizeFolder(String(a.folder)) !== doc.folder;
    if (move) assertNotPrivate(String(a.folder));
    const rename = a.title !== undefined && String(a.title).trim() !== doc.title;
    if (rename && def.titleRule === "derived") throw new ToolError(`${def.label} take their title from their fields`);
    if (move || rename) {
      // The same clashes moveDocument and renameDocument refuse, checked up front.
      const sameType = (await allDocuments()).filter((d) => d.type === doc.type);
      const folder = move ? normalizeFolder(String(a.folder)) : doc.folder;
      if (move && titleTaken(sameType, folder, doc.title, doc.id)) throw new ToolError(`“${doc.title}” already exists in ${folder || "the root"}`);
      const title = String(a.title ?? "").trim();
      if (rename && title && titleTaken(sameType, folder, title, doc.id)) throw new ToolError(`“${title}” already exists in ${folder || "the root"}`);
    }
    // A worn Role's Fields (ADR 0069) are written like the type's own.
    const patch: Args = await readFields(withRoleFields(doc, def) ?? def, (a.fields as Args | undefined) ?? {});
    if (a.body !== undefined) {
      if (def.body === "none") throw new ToolError(`${def.label} have no body`);
      patch.body = a.body;
    }
    if (a.tags !== undefined) patch.tags = a.tags;

    const changed: string[] = [];
    if (move) {
      await moveDocument(doc, String(a.folder)).catch((e: Error) => {
        throw new ToolError(e.message);
      });
      changed.push("folder");
      doc = await visibleDocument(a.id);
    }
    if (rename) {
      await renameDocument(doc, String(a.title)).catch((e: Error) => {
        throw new ToolError(e.message);
      });
      changed.push("title");
    }
    if (Object.keys(patch).length) {
      await patchDocument(doc.id, patch);
      changed.push(...Object.keys(patch));
    }
    return { id: doc.id, message: changed.length ? `Updated ${changed.join(", ")}` : "Nothing to change" };
  },
};

/** Run one tool. Command tools run the App's Command through Core's argument check. */
export async function runTool(name: string, args: Args): Promise<unknown> {
  const spec = TOOLS.find((t) => t.name === name);
  if (!spec) throw new ToolError(`Unknown tool ${name}`);
  const { workspace, ...rest } = args;
  await enterWorkspace(workspace);
  if (spec.command) {
    const def = allCommands().find((c) => c.id === spec.command);
    if (!def) throw new ToolError(`Command ${spec.command} is gone`);
    return invokeCommand(def, rest).catch((e: Error) => {
      throw new ToolError(e.message);
    });
  }
  return handlers[name](rest);
}
