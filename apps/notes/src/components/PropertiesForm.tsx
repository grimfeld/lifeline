import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@lifeline/ui";
import type { NoteTypeDef, PropertyDef } from "../domain/noteTypes";
import type { Properties, PropertyValue } from "../domain/markdown";

const NONE = "__none__";

/** Typed Properties of a Note type, rendered as a form; values are frontmatter (ADR 0009). */
export function PropertiesForm({ type, value, onChange }: { type: NoteTypeDef; value: Properties; onChange: (next: Properties) => void }) {
  if (type.properties.length === 0) return null;
  const set = (key: string, v: PropertyValue) => onChange({ ...value, [key]: v });
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {type.properties.map((p) => (
        <div key={p.key} className="grid gap-1">
          <Label htmlFor={`prop-${p.key}`} className="text-muted-foreground text-xs">
            {p.label}
          </Label>
          <Field def={p} value={value[p.key]} onChange={(v) => set(p.key, v)} />
        </div>
      ))}
    </div>
  );
}

function Field({ def, value, onChange }: { def: PropertyDef; value: PropertyValue | undefined; onChange: (v: PropertyValue) => void }) {
  const id = `prop-${def.key}`;
  switch (def.kind) {
    case "text":
    case "geo":
      return <Input id={id} className="h-8" value={String(value ?? "")} placeholder={def.kind === "geo" ? "lat,lng" : ""} onChange={(e) => onChange(e.target.value)} />;
    case "number":
      return <Input id={id} className="h-8" type="number" value={value === undefined ? "" : String(value)} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} />;
    case "date":
      return <Input id={id} className="h-8" type="date" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
    case "list":
      return (
        <Input
          id={id}
          className="h-8"
          placeholder="comma-separated"
          value={Array.isArray(value) ? value.join(", ") : String(value ?? "")}
          onChange={(e) => onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
        />
      );
    case "select":
      return (
        <Select value={value === undefined || value === "" ? NONE : String(value)} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
          <SelectTrigger id={id} className="h-8 w-full">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>—</SelectItem>
            {def.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
  }
}
