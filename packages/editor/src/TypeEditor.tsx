import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Button, Checkbox, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, TYPE_ICONS, cn, toast, typeIcon } from "@lifeline/ui";
import {
  DEFAULT_REPORTS,
  mentionable,
  type ReportSetting,
  MODULES,
  basePath,
  countTypeDocuments,
  deleteDocumentType,
  deleteUserDocumentType,
  documentsOfTypeEverywhere,
  fieldChangeProblems,
  fieldsFromDrafts,
  newFieldDraft,
  optionsFromText,
  optionsText,
  toFieldDrafts,
  kindLabel,
  normalizeFolder,
  removedFieldValues,
  reservedKeyProblems,
  roleDef,
  saveDocumentType,
  singularOf,
  slugify,
  templatesFor,
  templatesPath,
  typeDeleteRefusal,
  TEMPLATE_TYPE,
  useAllDocuments,
  type BodyPolicy,
  type Document,
  type DocumentTypeDef,
  type DocumentTypeRecord,
  type FieldDef,
  type FieldDraft,
  type FieldKind,
  type LinkTarget,
} from "@lifeline/core";
import { Plus, Trash2 } from "lucide-react";
import { ReportsEditor } from "./Reports";

const KINDS: FieldKind[] = ["text", "longtext", "number", "boolean", "date", "datetime", "select", "multiselect", "url", "geo", "list", "link", "links"];

/** One Field row of the form: a core Field draft (spec #95) plus the comma box's text as typed. */
type Row = FieldDraft & { optionsText: string };

const toRows = (fields: FieldDef[]): Row[] => toFieldDrafts(fields).map((d) => ({ ...d, optionsText: optionsText(d.options) }));
const blankRow = (key = "", label = "", kind: FieldKind = "text"): Row => ({ ...newFieldDraft(kind), key, label, optionsText: "" });
/** The "Links to" picker's value: one type, Any, or a restriction it can't show (several types, a Role), kept as is. */
const KEPT = "__kept__";
const linkPick = (t: LinkTarget): string => (t.to === "any" ? "__any__" : t.to === "types" && t.types.length === 1 ? t.types[0] : KEPT);

/**
 * Create / edit a user-defined Document type (ADR 0019), or customise a
 * built-in's label, icon, folder and the Fields beside its own: one editor,
 * opened from Bases and from the Journal's Types. Changes to a type that
 * holds Documents keep every value they hold (CONTEXT.md "Field"); deleting
 * waits until the type is empty (ADR 0072).
 */
export function TypeEditor({
  record,
  base,
  allTypes,
  defaultModule = "",
  onDone,
}: {
  record: DocumentTypeRecord | null;
  /** Built-in being customised (seeds the form when no record exists yet). */
  base?: DocumentTypeDef;
  allTypes: DocumentTypeDef[];
  /** Home Module a new type starts in — the Journal's "New type" homes it there. */
  defaultModule?: string;
  onDone: () => void;
}) {
  const [label, setLabel] = useState(record?.label ?? base?.label ?? "");
  const [icon, setIcon] = useState(record?.icon ?? base?.iconName ?? "file-text");
  const [folder, setFolder] = useState(record?.folder ?? base?.folder ?? "");
  const [body, setBody] = useState<BodyPolicy>(record?.body ?? base?.body ?? "optional");
  const [linkable, setLinkable] = useState(record?.linkable ?? (base ? !!base.linkable : true));
  // A built-in's own Fields stay its App's (CONTEXT.md "Field"): the form holds only the ones the user adds beside them.
  const ownKeys = new Set((base?.fields ?? []).map((f) => f.key));
  const savedFields = useMemo(() => (record?.fields ?? []).filter((f) => !ownKeys.has(f.key)), [record, base]);
  const [rows, setRows] = useState<Row[]>(
    record || base ? toRows(savedFields) : [blankRow("aliases", "Aliases", "list")],
  );
  const [module, setModule] = useState(record?.module ?? defaultModule);
  const [reports, setReports] = useState<ReportSetting[]>(record?.reports ?? base?.reports ?? DEFAULT_REPORTS);
  // Reports count the Days that name a Document (ADR 0076): only a type that can be named has any.
  const hasReports = base ? mentionable(base) : linkable;
  const [locatableField] = useState(record?.locatableField ?? (typeof base?.locatable === "string" ? base.locatable : ""));
  const fixedFolder = base?.id === "daily" || base?.id === "template";
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState("");
  const typeId = record?.typeId ?? base?.id ?? slugify(singularOf({ label }));
  const idTaken = !record && !base && allTypes.some((t) => t.id === typeId);
  const geoRows = rows.filter((r) => r.kind === "geo" && r.key.trim());
  const docs = useAllDocuments();
  const templates = templatesFor(typeId, docs.filter((d) => d.type === TEMPLATE_TYPE)).length;

  // Every Document of the type, in every Workspace: what a change must keep fitting (counted, never shown).
  const [held, setHeld] = useState<Document[]>([]);
  useEffect(() => {
    if (!record && !base) return;
    let live = true;
    void documentsOfTypeEverywhere(typeId).then((d) => live && setHeld(d));
    return () => {
      live = false;
    };
  }, [record, base, typeId]);
  const next = fieldsFromDrafts(rows);
  const problems = fieldChangeProblems(savedFields, next, held);
  const removed = removedFieldValues(savedFields, next, held).filter((r) => r.count > 0);
  // A Document's own keys are never Field keys (spec #95): a new one blocks saving, a saved one is only warned about.
  const reserved = reservedKeyProblems(savedFields, next);
  const reservedRefused = reserved.filter((p) => p.refused);

  async function save() {
    if (!label.trim() || !typeId) return;
    if (idTaken) return void toast.error(`A type with id “${typeId}” already exists`);
    if (problems.length) return void toast.error(problems[0]);
    if (reservedRefused.length) return void toast.error(reservedRefused[0].message);
    setBusy(true);
    try {
      await saveDocumentType({
        id: record?.id,
        typeId,
        label: label.trim(),
        icon,
        folder: normalizeFolder(folder),
        fields: next,
        body: base ? undefined : body,
        linkable: base ? undefined : linkable,
        locatableField: base ? undefined : geoRows.some((r) => r.key === locatableField) ? locatableField : (geoRows[0]?.key ?? ""),
        // Kept as is: the startup move turns old text into a Template; a user type no longer reads it.
        template: base ? undefined : (record?.template ?? ""),
        module: base ? undefined : module,
        reports: hasReports ? reports : (record?.reports ?? undefined),
        order: record?.order ?? 0,
      });
      toast.success(record || base ? `“${label.trim()}” updated` : `Type “${label.trim()}” created — its Base is ready`);
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!record) return;
    if (base) {
      if (!window.confirm(`Reset “${record.label}” to its built-in default? Fields you added keep their values on its Documents.`)) return;
      await deleteDocumentType(record.id);
      toast.success(`“${record.label}” reset to its built-in default`);
      return onDone();
    }
    const why = typeDeleteRefusal(record.label, await countTypeDocuments(record.typeId));
    if (why) return setRefusal(why);
    if (!window.confirm(`Delete the type “${record.label}”? It has no Documents.`)) return;
    try {
      await deleteUserDocumentType(record);
      toast.success(`Type “${record.label}” deleted`);
      onDone();
    } catch (e) {
      setRefusal((e as Error).message);
    }
  }

  const setRow = (i: number, patch: Partial<Row>) => setRows(rows.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const Icon = typeIcon(icon);
  return (
    <div className="grid min-w-0 gap-3">
      <div className="grid gap-1">
        <Label className="text-xs">Name</Label>
        <Input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="People" />
        <span className={cn("truncate text-[10px]", idTaken ? "text-destructive" : "text-muted-foreground")}>
          id: {typeId || "…"}
          {record || base ? " (fixed)" : ""}
        </span>
      </div>
      {!fixedFolder && (
        <div className="grid gap-1">
          <Label className="text-xs">Default folder</Label>
          <Input value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="People (empty = root)" />
        </div>
      )}
      {!base && (
        <div className="grid gap-1">
          <Label className="text-xs">Home Module</Label>
          <Select value={module || "__none__"} onValueChange={(v) => setModule(v === "__none__" ? "" : v)}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None — opens in its Base</SelectItem>
              {MODULES.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground text-[10px]">Where its Documents live and open — People and Places in the Journal.</span>
        </div>
      )}
      {base && base.fields.some((f) => !f.hidden) && (
        <p className="text-muted-foreground text-xs">
          Its own fields — {base.fields.filter((f) => !f.hidden).map((f) => f.label).join(", ")} — stay its App's. Fields added below sit beside them.
        </p>
      )}
      {fixedFolder && <p className="text-muted-foreground text-xs">Folder is fixed by rule ({base?.id === "daily" ? "Journal/YYYY/MM" : "Templates"}).</p>}
      {!base && (
        <div className="grid gap-2 md:grid-cols-2">
          <div className="grid min-w-0 gap-1">
            <Label className="text-xs">Writing</Label>
            <Select value={body} onValueChange={(v) => setBody(v as BodyPolicy)}>
              <SelectTrigger className="h-8 min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="required">Always — each one is a page to write</SelectItem>
                <SelectItem value="optional">Optional — fields first, writing if any</SelectItem>
                <SelectItem value="none">None — fields only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid min-w-0 gap-1">
            <Label className="text-xs">Contracts</Label>
            <label className="flex min-h-8 items-center gap-2 text-sm">
              <Checkbox checked={linkable} onCheckedChange={(c) => setLinkable(c === true)} /> Linkable — [[link]] to it by name or alias
            </label>
            {geoRows.length > 0 && <span className="text-muted-foreground text-xs">Locatable via “{geoRows.find((r) => r.key === locatableField)?.label ?? geoRows[0].label}”</span>}
          </div>
        </div>
      )}
      <div className="grid gap-1">
        <Label className="flex items-center gap-1 text-xs">
          Icon <Icon className="size-3.5" />
        </Label>
        <div className="grid grid-cols-8 gap-1 md:grid-cols-12">
          {Object.entries(TYPE_ICONS).map(([name, I]) => (
            <button key={name} type="button" title={name} aria-label={name} className={cn("flex size-7 items-center justify-center rounded-md border", icon === name ? "border-primary bg-primary/10" : "hover:bg-accent")} onClick={() => setIcon(name)}>
              <I className="size-4" />
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-1">
        <Label className="text-xs">Fields</Label>
        <div className="grid gap-2 md:gap-1">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_28px] items-center gap-1 rounded-md border p-1 md:grid-cols-[1fr_1fr_130px_1fr_28px] md:border-0 md:p-0">
              <Input
                className="h-8 min-w-0"
                placeholder="key"
                value={r.key}
                readOnly={r.saved}
                title={r.saved ? "A field's key is fixed once saved — change its label instead" : undefined}
                aria-label="Field key"
                onChange={(e) => setRow(i, { key: e.target.value })}
              />
              <Input className="h-8 min-w-0" placeholder="Label" aria-label="Field label" value={r.label} onChange={(e) => setRow(i, { label: e.target.value })} />
              <Button size="icon" variant="ghost" className="size-7 md:order-last" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Remove field">
                <Trash2 className="size-3.5" />
              </Button>
              <Select value={r.kind} onValueChange={(v) => setRow(i, { kind: v as FieldKind })}>
                <SelectTrigger className="h-8 min-w-0" aria-label="Field kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {kindLabel(k)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {r.kind === "link" || r.kind === "links" ? (
                <Select value={linkPick(r.target)} onValueChange={(v) => v !== KEPT && setRow(i, { target: v === "__any__" ? { to: "any" } : { to: "types", types: [v] } })}>
                  <SelectTrigger className="h-8 min-w-0" aria-label="Links to">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__any__">Any type</SelectItem>
                    {linkPick(r.target) === KEPT && (
                      <SelectItem value={KEPT}>
                        {r.target.to === "role" ? `Role: ${roleDef(r.target.role)?.label ?? r.target.role}` : r.target.to === "types" ? r.target.types.map((id) => allTypes.find((t) => t.id === id)?.label ?? id).join(", ") : ""}
                      </SelectItem>
                    )}
                    {allTypes
                      .filter((t) => !t.internal)
                      .map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  className="h-8 min-w-0"
                  aria-label="Choices"
                  placeholder={r.kind === "select" || r.kind === "multiselect" ? "a, b=Label B" : ""}
                  disabled={r.kind !== "select" && r.kind !== "multiselect"}
                  value={r.optionsText}
                  onChange={(e) => setRow(i, { optionsText: e.target.value, options: optionsFromText(e.target.value, r.options) })}
                />
              )}
            </div>
          ))}
          <Button size="sm" variant="outline" className="justify-self-start" onClick={() => setRows([...rows, blankRow()])}>
            <Plus /> Field
          </Button>
        </div>
        {problems.map((p) => (
          <p key={p} className="text-destructive text-xs">
            {p}
          </p>
        ))}
        {reserved.map((p) => (
          <p key={p.key} className={cn("text-xs", p.refused ? "text-destructive" : "text-muted-foreground")}>
            “{p.label}”: {p.message}
          </p>
        ))}
        {removed.map(({ field, count }) => (
          <p key={field.key} className="text-muted-foreground text-xs">
            {count} Document{count === 1 ? "" : "s"} have a value for “{field.label}” — they keep it, and it comes back if you add “{field.key}” again.
          </p>
        ))}
      </div>
      {hasReports && (
        <div className="grid gap-1">
          <Label className="text-xs">Reports</Label>
          <span className="text-muted-foreground text-[10px]">Figures from the Days that link to its Documents — on the type's page, each Document's page and the Journal's periods.</span>
          <ReportsEditor value={reports} onChange={setReports} />
        </div>
      )}
      {(record || base) && (base ? base.body !== "none" : body !== "none") && (
        <div className="flex min-w-0 items-center gap-2 text-xs">
          <span className="text-muted-foreground min-w-0 flex-1">New ones start from its Templates.</span>
          <Link to={templatesPath(typeId)} onClick={onDone} className="shrink-0 underline underline-offset-2">
            {templates === 0 ? "Make a template" : `Templates · ${templates}`}
          </Link>
        </div>
      )}
      {refusal && (
        <p className="text-destructive text-xs">
          {refusal}{" "}
          <Link to={basePath(typeId)} onClick={onDone} className="underline underline-offset-2">
            Open its Base
          </Link>
        </p>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {record && (
          <Button variant="ghost" className="text-destructive mr-auto" onClick={() => void remove()}>
            <Trash2 /> {base ? "Reset to default" : "Delete type"}
          </Button>
        )}
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={() => void save()} disabled={busy || !label.trim() || idTaken || problems.length > 0 || reservedRefused.length > 0}>
          {record || base ? "Save" : "Create type"}
        </Button>
      </div>
    </div>
  );
}
