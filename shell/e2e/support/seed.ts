/**
 * Seeds the local store with the longest content a person could plausibly
 * type: every headless Command run once, every Document type given at least
 * one Document, every Field filled, every Card placed on one Screen. Runs in
 * the page, against the very Core module instance the app is using (Vite
 * serves the workspace package at its /@fs path), so new Apps, types, fields
 * and Cards are seeded without touching this file.
 */

export const CORE_URL = "/@fs/" + new URL("../../../packages/core/src/index.ts", import.meta.url).pathname.replace(/^\/+/, "");

/** Text with no break opportunity: what a URL, a code or a German compound looks like to the layout. */
export const LONG_WORD = "Donaudampfschifffahrtselektrizitätenhauptbetriebswerkbauunterbeamtengesellschaft";

export function longText(label: string): string {
  return `${label} with an exceptionally long name that keeps on going well past any sensible width ${LONG_WORD}`;
}

export interface SeedReport {
  /** Command ids that refused the seeded arguments, with why — informational. */
  failedCommands: string[];
  /** Type ids that could not be given a Document. */
  failedTypes: string[];
  screenId: string;
}

/** Runs inside the page (serialised by Playwright): no closures over this module. */
export async function seedInPage(arg: { coreUrl: string; longWord: string }): Promise<SeedReport> {
  const core = await import(/* @vite-ignore */ arg.coreUrl);
  const long = (label: string) => `${label} with an exceptionally long name that keeps on going well past any sensible width ${arg.longWord}`;
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const failedCommands: string[] = [];
  const failedTypes: string[] = [];

  await core.ensureDefaultWorkspace();

  const docsOfType = async (types: string | string[] | undefined): Promise<{ id: string; type: string }[]> => {
    const all = (await core.allDocuments()) as { id: string; type: string }[];
    if (!types) return all;
    const list = Array.isArray(types) ? types : [types];
    return all.filter((d) => list.includes(d.type));
  };

  // Every headless Command, with every argument filled. Run before and after
  // the generic Documents, so Commands that need a Stat, a Habit or a Shop
  // find one the second time.
  const commandsRun = new Set<string>();
  const runCommands = async (final: boolean) => {
  for (const cmd of core.allCommands()) {
    if (!core.isInvocable(cmd) || commandsRun.has(cmd.id)) continue;
    let hour = 9;
    // A `rows` argument is filled with one row, by the same rules.
    const fill = async (args: typeof cmd.args): Promise<Record<string, unknown>> => {
      const raw: Record<string, unknown> = {};
      for (const a of args) {
        switch (a.kind) {
          case "text":
          case "longtext":
            raw[a.key] = long(a.label);
            break;
          case "number":
            raw[a.key] = a.required ? 3 : undefined;
            break;
          case "date":
            raw[a.key] = day;
            break;
          case "time":
            raw[a.key] = `${pad(++hour)}:00`;
            break;
          case "select":
            raw[a.key] = a.options?.[0]?.value;
            break;
          case "multiselect":
            raw[a.key] = a.options?.slice(0, 1).map((o: { value: string }) => o.value);
            break;
          case "list":
            raw[a.key] = [`${arg.longWord}-tag`];
            break;
          case "link": {
            const [doc] = await docsOfType(a.linkType);
            raw[a.key] = doc?.id;
            break;
          }
          case "json": {
            // The hint spells the shape out by example; take the first one.
            const example = a.hint?.match(/\{[^{}]*\}/)?.[0];
            if (a.required && example) raw[a.key] = JSON.parse(example);
            break;
          }
          case "rows":
            raw[a.key] = [await fill(a.of ?? [])];
            break;
          default:
            break;
        }
        if (raw[a.key] === undefined) delete raw[a.key];
      }
      return raw;
    };
    const raw = await fill(cmd.args);
    try {
      await core.invokeCommand(cmd, raw);
      commandsRun.add(cmd.id);
    } catch (e) {
      if (final) failedCommands.push(`${cmd.id}: ${(e as Error).message}`);
    }
  }
  };
  await runCommands(false);

  // Two user-defined types homed in the Journal, so its Types page is checked
  // holding one (filled below like any type) and one left empty. The first's
  // Choice and Links carry long option and type labels for the Type editor.
  const userTypes = [
    {
      typeId: "e2eperson",
      label: long("People"),
      fields: [
        { key: "born", label: long("Born"), kind: "date" },
        { key: "aliases", label: "Aliases", kind: "list" },
        { key: "mood", label: long("Mood"), kind: "select", options: [{ value: "home", label: long("At home") }, { value: arg.longWord, label: arg.longWord }] },
        { key: "met", label: long("Met at"), kind: "links", linkType: ["e2eperson", "e2eempty"] },
        { key: "favourite", label: long("Favourite author"), kind: "link", linkRole: "author" },
      ],
    },
    { typeId: "e2eempty", label: long("Places"), fields: [] },
  ];
  for (const t of userTypes) await core.saveDocumentType({ ...t, icon: "user", folder: "", body: "optional", linkable: true, module: "journal", order: 0 });
  for (let i = 0; i < 40 && !userTypes.every((t) => core.documentTypeSync(t.typeId)); i++) await new Promise((r) => setTimeout(r, 50));

  // Every Document type gets a Document with every Field filled.
  const types = (core.allDocumentTypes() as { id: string }[]).filter((t) => t.id !== "e2eempty") as {
    id: string;
    label: string;
    body: string;
    titleRule: string;
    fields: { key: string; kind: string; options?: { value: string }[]; linkType?: string | string[] }[];
  }[];
  const fieldValue = async (f: (typeof types)[number]["fields"][number]): Promise<unknown> => {
    switch (f.kind) {
      case "text":
      case "longtext":
        return long(f.key);
      case "url":
        return `https://example.com/${arg.longWord}/${arg.longWord}`;
      case "number":
        return 12345;
      case "boolean":
        return false; // "archived", "done": true would hide the Document from most screens.
      case "date":
        return day;
      case "datetime":
        return `${day}T10:00`;
      case "select":
        return f.options?.[0]?.value;
      case "multiselect":
        return f.options?.map((o) => o.value);
      case "list":
        return [long("item"), arg.longWord];
      case "link": {
        const [doc] = await docsOfType(f.linkType);
        return doc?.id;
      }
      case "links":
        return (await docsOfType(f.linkType)).slice(0, 3).map((d) => d.id);
      default:
        return undefined; // geo, json: their owning App writes them.
    }
  };
  const existing = new Set((await docsOfType(undefined)).map((d) => d.type));
  for (const def of types) {
    if (existing.has(def.id)) continue;
    try {
      const fields: Record<string, unknown> = {};
      for (const f of def.fields) {
        const v = await fieldValue(f);
        if (v !== undefined) fields[f.key] = v;
      }
      await core.putDocument({
        ...fields,
        type: def.id,
        title: def.titleRule === "derived" ? undefined : long(def.label),
        folder: `${long("Folder")}/${arg.longWord}`,
        tags: [`${arg.longWord}-tag`],
        body: def.body === "none" ? undefined : `# ${long("Heading")}\n\n${long("Paragraph")} ${arg.longWord}${arg.longWord}\n\n- ${long("List item")}\n\n#${arg.longWord}`,
      });
    } catch (e) {
      failedTypes.push(`${def.id}: ${(e as Error).message}`);
    }
  }

  await runCommands(true);

  // One Screen holding every Card, entity Cards pointed at their App's first Document.
  const docs = (await core.allDocuments()) as { id: string; type: string }[];
  const layout = [];
  let y = 0;
  for (const card of core.allCards()) {
    const settings: Record<string, unknown> = {};
    for (const [key, f] of Object.entries((card.settings ?? {}) as Record<string, { kind: string }>)) {
      if (f.kind !== "entity") continue;
      const own = docs.find((d) => core.documentTypeSync(d.type)?.appId === card.appId);
      if (own) settings[key] = own.id;
    }
    layout.push({ instanceId: `e2e-${card.id}`, cardId: card.id, settings, x: 0, y, w: Math.max(card.defaultSize.w, 4), h: card.defaultSize.h });
    y += card.defaultSize.h;
  }
  const screenId = "e2elongcontent1";
  await core.put("screens", { id: screenId, name: long("Screen"), layout, sort: 0, workspace: core.currentWorkspaceId() });

  return { failedCommands, failedTypes, screenId };
}
