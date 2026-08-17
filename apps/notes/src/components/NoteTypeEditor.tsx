import { useEffect, useState } from "react";
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, cn, toast } from "@lifeline/ui";
import { Plus, Trash2 } from "lucide-react";
import { TYPE_ICONS, slugify, typeIcon, type NoteTypeDef, type PropertyDef } from "../domain/noteTypes";
import { normalizeFolder } from "../domain/folders";
import { saveNoteType, type NoteTypeRecord } from "../data/noteTypes";

const KINDS: { value: PropertyDef["kind"]; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Choice" },
  { value: "list", label: "List" },
  { value: "geo", label: "Coordinates" },
];

type Row = { key: string; label: string; kind: PropertyDef["kind"]; options: string };

function toRows(props: PropertyDef[]): Row[] {
  return props.map((p) => ({ key: p.key, label: p.label, kind: p.kind, options: p.kind === "select" ? p.options.map((o) => (o.value === o.label ? o.value : `${o.value}=${o.label}`)).join(", ") : "" }));
}
function fromRows(rows: Row[]): PropertyDef[] {
  return rows
    .filter((r) => r.key.trim())
    .map((r) => {
      const key = slugify(r.key) || r.key.trim();
      const label = r.label.trim() || r.key.trim();
      if (r.kind === "select") {
        const options = r.options
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => {
            const [v, l] = s.split("=");
            return { value: v.trim(), label: (l ?? v).trim() };
          });
        return { key, label, kind: "select", options };
      }
      return { key, label, kind: r.kind } as PropertyDef;
    });
}

/** Create / edit a user-defined Note type: label, icon, default folder, typed properties. */
export function NoteTypeEditor({ record, base, existingIds, onDone }: { record: NoteTypeRecord | null; /** Built-in being customised (seeds the form when no record exists yet). */ base?: NoteTypeDef; existingIds: string[]; onDone: () => void }) {
  const [label, setLabel] = useState(record?.label ?? base?.label ?? "");
  const [plural, setPlural] = useState(record?.plural ?? base?.plural ?? "");
  const [icon, setIcon] = useState(record?.icon ?? base?.iconName ?? "file-text");
  const [folder, setFolder] = useState(record?.folder ?? base?.folder ?? "");
  const [rows, setRows] = useState<Row[]>(record ? toRows(record.properties) : base ? toRows(base.properties) : [{ key: "aliases", label: "Aliases", kind: "list", options: "" }]);
  const fixedFolder = base?.id === "daily" || base?.id === "template";
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!record && label && !plural) setPlural(label + "s");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label]);
  const typeId = record?.typeId ?? base?.id ?? slugify(label);
  const idTaken = !record && !base && existingIds.includes(typeId);

  async function save() {
    if (!label.trim() || !typeId) return;
    if (idTaken) return void toast.error(`A type with id “${typeId}” already exists`);
    setBusy(true);
    try {
      await saveNoteType({
        id: record?.id,
        typeId,
        label: label.trim(),
        plural: plural.trim() || label.trim(),
        icon,
        folder: normalizeFolder(folder),
        properties: fromRows(rows),
        order: record?.order ?? 0,
      });
      toast.success(record || base ? `“${label.trim()}” updated` : `Type “${label.trim()}” created`);
      onDone();
    } finally {
      setBusy(false);
    }
  }

  const Icon = typeIcon(icon);
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1">
          <Label className="text-xs">Name</Label>
          <Input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Recipe" />
          <span className={cn("text-[10px]", idTaken ? "text-destructive" : "text-muted-foreground")}>id: {typeId || "…"}{record || base ? " (fixed)" : ""}</span>
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">Plural</Label>
          <Input value={plural} onChange={(e) => setPlural(e.target.value)} placeholder="Recipes" />
        </div>
      </div>
      {!fixedFolder && (
        <div className="grid gap-1">
          <Label className="text-xs">Default folder</Label>
          <Input value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="Recipes (empty = root)" />
        </div>
      )}
      {fixedFolder && <p className="text-muted-foreground text-xs">Folder is fixed by rule ({base?.id === "daily" ? "Journal/YYYY/MM" : "Templates"}); the date-title rule stays.</p>}
      <div className="grid gap-1">
        <Label className="text-xs flex items-center gap-1">
          Icon <Icon className="size-3.5" />
        </Label>
        <div className="grid grid-cols-10 gap-1">
          {Object.entries(TYPE_ICONS).map(([name, I]) => (
            <button key={name} type="button" title={name} className={cn("flex size-7 items-center justify-center rounded-md border", icon === name ? "border-primary bg-primary/10" : "hover:bg-accent")} onClick={() => setIcon(name)}>
              <I className="size-4" />
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-1">
        <Label className="text-xs">Properties (stored as frontmatter)</Label>
        <div className="grid gap-1">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_110px_1fr_28px] items-center gap-1">
              <Input className="h-8" placeholder="key" value={r.key} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))} />
              <Input className="h-8" placeholder="Label" value={r.label} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              <Select value={r.kind} onValueChange={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, kind: v as PropertyDef["kind"] } : x)))}>
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
              <Input className="h-8" placeholder={r.kind === "select" ? "a, b=Label B" : ""} disabled={r.kind !== "select"} value={r.options} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, options: e.target.value } : x)))} />
              <Button size="icon" variant="ghost" className="size-7" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Remove property">
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
          <Button size="sm" variant="outline" className="justify-self-start" onClick={() => setRows([...rows, { key: "", label: "", kind: "text", options: "" }])}>
            <Plus /> Property
          </Button>
        </div>
      </div>
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
