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
  addOption,
  allRoles,
  fieldsFromDrafts,
  fieldSummary,
  hasFieldSettings,
  newFieldDraft,
  rekeyField,
  relabelField,
  removeOption,
  renameOption,
  toFieldDrafts,
  kindLabel,
  kindRefusals,
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
  type SummaryNames,
} from "@lifeline/core";
import { Plus, Settings2, Trash2, X } from "lucide-react";
import { ReportsEditor } from "./Reports";

const KINDS: FieldKind[] = ["text", "longtext", "number", "boolean", "date", "datetime", "select", "multiselect", "url", "geo", "list", "link", "links"];

/** One Field row of the form: a core Field draft (spec #95) with a stable id for its fold-out. */
type Row = FieldDraft & { uid: number };

let nextUid = 0;
const withUid = (d: FieldDraft): Row => ({ ...d, uid: nextUid++ });
const toRows = (fields: FieldDef[]): Row[] => toFieldDrafts(fields).map(withUid);

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
    record || base ? toRows(savedFields) : [withUid(newFieldDraft("list", "Aliases"))],
  );
  // Fold-outs open (by row uid): several may be open at once.
  const [open, setOpen] = useState<Set<number>>(() => new Set());
  const toggle = (uid: number, on = !open.has(uid)) => setOpen((s) => (on ? new Set(s).add(uid) : new Set([...s].filter((x) => x !== uid))));
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

  const linkTypes = allTypes.filter((t) => !t.internal);
  const names: SummaryNames = { typeLabel: (id) => allTypes.find((t) => t.id === id)?.label ?? id, roleLabel: (id) => roleDef(id)?.label ?? id };
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
            <FieldRow
              key={r.uid}
              row={r}
              open={open.has(r.uid)}
              names={names}
              linkTypes={linkTypes}
              refusals={kindRefusals(r, KINDS, held)}
              onToggle={() => toggle(r.uid)}
              onChange={(d) => {
                // Picking a kind with settings opens its fold-out straight away.
                if (d.kind !== r.kind && hasFieldSettings(d.kind)) toggle(r.uid, true);
                setRows(rows.map((x, j) => (j === i ? { ...d, uid: r.uid } : x)));
              }}
              onRemove={() => setRows(rows.filter((_, j) => j !== i))}
            />
          ))}
          <Button size="sm" variant="outline" className="justify-self-start" onClick={() => setRows([...rows, withUid(newFieldDraft())])}>
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

/**
 * One Field: Label · Kind · ⚙ · delete (spec #95). ⚙ only for kinds with
 * settings, which open in a fold-out under the row; folded, the row shows
 * their summary. A phone gives it two lines: Label; then Kind, ⚙, delete.
 */
function FieldRow({
  row,
  open,
  names,
  linkTypes,
  refusals,
  onToggle,
  onChange,
  onRemove,
}: {
  row: FieldDraft;
  open: boolean;
  names: SummaryNames;
  linkTypes: DocumentTypeDef[];
  /** Kinds this saved Field's held values wouldn't fit, each with why (kindRefusals). */
  refusals: Partial<Record<FieldKind, string>>;
  onToggle: () => void;
  onChange: (d: FieldDraft) => void;
  onRemove: () => void;
}) {
  const settings = hasFieldSettings(row.kind);
  const summary = settings ? fieldSummary(row, names) : "";
  return (
    <div className="grid min-w-0 gap-1 rounded-md border p-1 md:border-0 md:p-0">
      {/* A drag handle (#101) takes the first slot of this line. */}
      <div className="grid grid-cols-[minmax(0,1fr)_1.75rem_1.75rem] items-center gap-1 md:grid-cols-[minmax(0,1fr)_11.5rem_1.75rem_1.75rem]">
        <Input className="col-span-3 h-8 min-w-0 md:col-span-1" placeholder="Label" aria-label="Field label" value={row.label} onChange={(e) => onChange(relabelField(row, e.target.value))} />
        <Select value={row.kind} onValueChange={(v) => onChange({ ...row, kind: v as FieldKind })}>
          <SelectTrigger className="h-8 w-full min-w-0" aria-label="Field kind">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KINDS.map((k) => {
              // A kind the held values don't fit is off, its reason on hover and in the item (a phone has no hover).
              const why = refusals[k];
              return (
                <SelectItem key={k} value={k} disabled={!!why} title={why} className="data-disabled:pointer-events-auto">
                  {why ? (
                    <span className="grid min-w-0">
                      <span>{kindLabel(k)}</span>
                      <span className="text-muted-foreground text-[10px] whitespace-normal">{why}</span>
                    </span>
                  ) : (
                    kindLabel(k)
                  )}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {settings ? (
          <Button size="icon" variant={open ? "secondary" : "ghost"} className="size-7" onClick={onToggle} aria-label="Field settings" aria-expanded={open} title={summary}>
            <Settings2 className="size-3.5" />
          </Button>
        ) : (
          <span />
        )}
        <Button size="icon" variant="ghost" className="size-7" onClick={onRemove} aria-label="Remove field">
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      {settings && !open && (
        <button type="button" className="text-muted-foreground min-w-0 truncate px-1 text-left text-[10px]" onClick={onToggle}>
          {summary}
        </button>
      )}
      {settings && open && <FieldSettings row={row} linkTypes={linkTypes} onChange={onChange} />}
    </div>
  );
}

/** A Field's fold-out: its key (editable until saved), then a Choice's options or a Link's target. */
function FieldSettings({ row, linkTypes, onChange }: { row: FieldDraft; linkTypes: DocumentTypeDef[]; onChange: (d: FieldDraft) => void }) {
  const choice = row.kind === "select" || row.kind === "multiselect";
  return (
    <div className="bg-muted/40 grid min-w-0 gap-2 rounded-md p-2">
      {row.saved ? (
        <p className="text-muted-foreground text-[10px]">
          Key <code className="text-foreground">{row.key}</code> — fixed once saved; rename its label instead.
        </p>
      ) : (
        <div className="flex min-w-0 items-center gap-2">
          <Label className="shrink-0 text-xs">Key</Label>
          <Input className="h-7 min-w-0 flex-1" placeholder="key" aria-label="Field key" value={row.key} onChange={(e) => onChange(rekeyField(row, e.target.value))} />
          <span className="text-muted-foreground hidden shrink-0 text-[10px] md:inline">Fixed once saved</span>
        </div>
      )}
      {choice ? <OptionList row={row} onChange={onChange} /> : <LinkTargetPicker target={row.target} linkTypes={linkTypes} onChange={(target) => onChange({ ...row, target })} />}
    </div>
  );
}

/** A Choice's options, one line each: only the label is edited; the value is set when added (CONTEXT.md "Choice (field)"). */
function OptionList({ row, onChange }: { row: FieldDraft; onChange: (d: FieldDraft) => void }) {
  return (
    <div className="grid min-w-0 gap-1">
      <Label className="text-xs">Options</Label>
      {row.options.map((o, i) => (
        <div key={i} className="flex min-w-0 items-center gap-1">
          <Input className="h-7 min-w-0 flex-1" placeholder="Option" aria-label="Option label" value={o.label} onChange={(e) => onChange(renameOption(row, i, e.target.value))} />
          {/* The stored value, in a fixed column so the labels line up. */}
          <span className="text-muted-foreground w-20 shrink-0 truncate font-mono text-[10px] md:w-36" title={o.value ? `Stored as “${o.value}”` : undefined}>
            {o.value}
          </span>
          <Button size="icon" variant="ghost" className="size-7 shrink-0" onClick={() => onChange(removeOption(row, i))} aria-label="Remove option">
            <X className="size-3.5" />
          </Button>
        </div>
      ))}
      <Button size="sm" variant="ghost" className="h-7 justify-self-start" onClick={() => onChange(addOption(row))}>
        <Plus /> Option
      </Button>
    </div>
  );
}

/** A Link's target: Any, one or several types, or a Role (ADR 0069). */
function LinkTargetPicker({ target, linkTypes, onChange }: { target: LinkTarget; linkTypes: DocumentTypeDef[]; onChange: (t: LinkTarget) => void }) {
  const roles = allRoles();
  const chosen = target.to === "types" ? target.types : [];
  // The types it names come first (seen without scrolling), as they were when the fold-out opened — even ones the list doesn't offer (internal, gone).
  const [first] = useState(chosen);
  const label = (id: string) => linkTypes.find((t) => t.id === id)?.label ?? id;
  const offered = [...first, ...linkTypes.map((t) => t.id).filter((id) => !first.includes(id))].map((id) => ({ id, label: label(id) }));
  const roleIds = [...roles.map((r) => r.id), ...(target.to === "role" && !roles.some((r) => r.id === target.role) ? [target.role] : [])];
  const pickMode = (v: string) => onChange(v === "types" ? { to: "types", types: chosen } : v === "role" ? { to: "role", role: target.to === "role" ? target.role : (roles[0]?.id ?? "") } : { to: "any" });
  const tick = (id: string, on: boolean) => onChange({ to: "types", types: on ? [...chosen, id] : chosen.filter((x) => x !== id) });
  return (
    <div className="grid min-w-0 gap-1">
      <Label className="text-xs">Links to</Label>
      <Select value={target.to} onValueChange={pickMode}>
        <SelectTrigger className="h-8 w-full min-w-0 md:w-48" aria-label="Links to">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any">Any type</SelectItem>
          <SelectItem value="types">Types</SelectItem>
          {roleIds.length > 0 && <SelectItem value="role">A Role</SelectItem>}
        </SelectContent>
      </Select>
      {target.to === "types" && (
        <div className="grid max-h-48 min-w-0 gap-1 overflow-y-auto py-1 md:grid-cols-2">
          {offered.map((t) => (
            <label key={t.id} className="flex min-w-0 items-start gap-2 text-xs">
              <Checkbox className="mt-px shrink-0"checked={chosen.includes(t.id)} onCheckedChange={(c) => tick(t.id, c === true)} />
              <span className="min-w-0">{t.label}</span>
            </label>
          ))}
        </div>
      )}
      {target.to === "role" && (
        <Select value={target.role} onValueChange={(role) => onChange({ to: "role", role })}>
          <SelectTrigger className="h-8 w-full min-w-0 md:w-48" aria-label="Role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roleIds.map((id) => (
              <SelectItem key={id} value={id}>
                {roleDef(id)?.label ?? id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {target.to === "role" && <span className="text-muted-foreground text-[10px]">Documents of its home type, and any Document wearing it.</span>}
    </div>
  );
}
