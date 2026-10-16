import { useState } from "react";
import { Button, Checkbox, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, TYPE_ICONS, Textarea, cn, toast, typeIcon } from "@lifeline/ui";
import { MODULES, normalizeFolder, saveDocumentType, singularOf, slugify, type BodyPolicy, type DocumentTypeDef, type DocumentTypeRecord, type FieldDef, type FieldKind } from "@lifeline/core";
import { Plus, Trash2 } from "lucide-react";

const KINDS: { value: FieldKind; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "longtext", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Yes / no" },
  { value: "date", label: "Date" },
  { value: "datetime", label: "Date & time" },
  { value: "select", label: "Choice" },
  { value: "multiselect", label: "Multi-choice" },
  { value: "url", label: "URL" },
  { value: "geo", label: "Coordinates" },
  { value: "list", label: "List" },
  { value: "link", label: "Link to Document" },
  { value: "links", label: "Links to Documents" },
];

type Row = { key: string; label: string; kind: FieldKind; options: string; linkType: string };

function toRows(fields: FieldDef[]): Row[] {
  return fields.map((f) => ({
    key: f.key,
    label: f.label,
    kind: f.kind,
    options: f.options ? f.options.map((o) => (o.value === o.label ? o.value : `${o.value}=${o.label}`)).join(", ") : "",
    linkType: Array.isArray(f.linkType) ? "" : (f.linkType ?? ""),
  }));
}
function fromRows(rows: Row[]): FieldDef[] {
  return rows
    .filter((r) => r.key.trim())
    .map((r) => {
      const key = slugify(r.key).replace(/-/g, "_") || r.key.trim();
      const label = r.label.trim() || r.key.trim();
      const f: FieldDef = { key, label, kind: r.kind };
      if (r.kind === "select" || r.kind === "multiselect") {
        f.options = r.options
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => {
            const [v, l] = s.split("=");
            return { value: v.trim(), label: (l ?? v).trim() };
          });
      }
      if ((r.kind === "link" || r.kind === "links") && r.linkType) f.linkType = r.linkType;
      return f;
    });
}

/** Create / edit a user-defined Document type (ADR 0019): label, icon, folder, body policy, Fields, Contracts declared by data. */
export function TypeEditor({
  record,
  base,
  allTypes,
  onDone,
}: {
  record: DocumentTypeRecord | null;
  /** Built-in being customised (seeds the form when no record exists yet). */
  base?: DocumentTypeDef;
  allTypes: DocumentTypeDef[];
  onDone: () => void;
}) {
  const [label, setLabel] = useState(record?.label ?? base?.label ?? "");
  const [icon, setIcon] = useState(record?.icon ?? base?.iconName ?? "file-text");
  const [folder, setFolder] = useState(record?.folder ?? base?.folder ?? "");
  const [body, setBody] = useState<BodyPolicy>(record?.body ?? base?.body ?? "optional");
  const [linkable, setLinkable] = useState(record?.linkable ?? (base ? !!base.linkable : true));
  const [template, setTemplate] = useState(record?.template ?? base?.template ?? "");
  // A built-in's own Fields stay its App's (CONTEXT.md "Field"): the form holds only the ones the user adds beside them.
  const ownKeys = new Set((base?.fields ?? []).map((f) => f.key));
  const [rows, setRows] = useState<Row[]>(
    base ? toRows((record?.fields ?? []).filter((f) => !ownKeys.has(f.key))) : record ? toRows(record.fields) : [{ key: "aliases", label: "Aliases", kind: "list", options: "", linkType: "" }],
  );
  const [module, setModule] = useState(record?.module ?? "");
  const [locatableField] = useState(record?.locatableField ?? (typeof base?.locatable === "string" ? base.locatable : ""));
  const fixedFolder = base?.id === "daily" || base?.id === "template";
  const [busy, setBusy] = useState(false);
  const typeId = record?.typeId ?? base?.id ?? slugify(singularOf({ label }));
  const idTaken = !record && !base && allTypes.some((t) => t.id === typeId);
  const geoRows = rows.filter((r) => r.kind === "geo" && r.key.trim());

  async function save() {
    if (!label.trim() || !typeId) return;
    if (idTaken) return void toast.error(`A type with id “${typeId}” already exists`);
    setBusy(true);
    try {
      await saveDocumentType({
        id: record?.id,
        typeId,
        label: label.trim(),
        icon,
        folder: normalizeFolder(folder),
        fields: fromRows(rows),
        body: base ? undefined : body,
        linkable: base ? undefined : linkable,
        locatableField: base ? undefined : geoRows.some((r) => r.key === locatableField) ? locatableField : geoRows[0]?.key ?? "",
        template: base ? undefined : template,
        module: base ? undefined : module,
        order: record?.order ?? 0,
      });
      toast.success(record || base ? `“${label.trim()}” updated` : `Type “${label.trim()}” created — its Base is ready`);
      onDone();
    } finally {
      setBusy(false);
    }
  }

  const Icon = typeIcon(icon);
  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <Label className="text-xs">Name</Label>
        <Input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Recipe" />
        <span className={cn("text-[10px]", idTaken ? "text-destructive" : "text-muted-foreground")}>
          id: {typeId || "…"}
          {record || base ? " (fixed)" : ""}
        </span>
      </div>
      {!fixedFolder && (
        <div className="grid gap-1">
          <Label className="text-xs">Default folder</Label>
          <Input value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="Recipes (empty = root)" />
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
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1">
            <Label className="text-xs">Body</Label>
            <Select value={body} onValueChange={(v) => setBody(v as BodyPolicy)}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="required">Required — body-first, shown in the Vault tree</SelectItem>
                <SelectItem value="optional">Optional — fields first, body if written</SelectItem>
                <SelectItem value="none">None — fields only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Contracts</Label>
            <label className="flex h-8 items-center gap-2 text-sm">
              <Checkbox checked={linkable} onCheckedChange={(c) => setLinkable(c === true)} /> Linkable (wikilink target by title / aliases)
            </label>
            {geoRows.length > 0 && <span className="text-muted-foreground text-xs">Locatable via “{geoRows.find((r) => r.key === locatableField)?.label ?? geoRows[0].label}”</span>}
          </div>
        </div>
      )}
      <div className="grid gap-1">
        <Label className="flex items-center gap-1 text-xs">
          Icon <Icon className="size-3.5" />
        </Label>
        <div className="grid grid-cols-12 gap-1">
          {Object.entries(TYPE_ICONS).map(([name, I]) => (
            <button key={name} type="button" title={name} className={cn("flex size-7 items-center justify-center rounded-md border", icon === name ? "border-primary bg-primary/10" : "hover:bg-accent")} onClick={() => setIcon(name)}>
              <I className="size-4" />
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-1">
        <Label className="text-xs">Fields</Label>
        <div className="grid gap-1">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_130px_1fr_28px] items-center gap-1">
              <Input className="h-8" placeholder="key" value={r.key} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))} />
              <Input className="h-8" placeholder="Label" value={r.label} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              <Select value={r.kind} onValueChange={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, kind: v as FieldKind } : x)))}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {r.kind === "link" || r.kind === "links" ? (
                <Select value={r.linkType || "__any__"} onValueChange={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, linkType: v === "__any__" ? "" : v } : x)))}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__any__">Any type</SelectItem>
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
                  className="h-8"
                  placeholder={r.kind === "select" || r.kind === "multiselect" ? "a, b=Label B" : ""}
                  disabled={r.kind !== "select" && r.kind !== "multiselect"}
                  value={r.options}
                  onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, options: e.target.value } : x)))}
                />
              )}
              <Button size="icon" variant="ghost" className="size-7" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Remove field">
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
          <Button size="sm" variant="outline" className="justify-self-start" onClick={() => setRows([...rows, { key: "", label: "", kind: "text", options: "", linkType: "" }])}>
            <Plus /> Field
          </Button>
        </div>
      </div>
      {!base && body !== "none" && (
        <div className="grid gap-1">
          <Label className="text-xs">Body template</Label>
          <Textarea rows={3} value={template} onChange={(e) => setTemplate(e.target.value)} placeholder={"## Notes\n\n{{date}}"} />
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={() => void save()} disabled={busy || !label.trim() || idTaken}>
          {record || base ? "Save" : "Create type"}
        </Button>
      </div>
    </div>
  );
}
