import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@lifeline/ui";
import { type CardFieldDef, type CardSettings, type CardSettingsSchema, type CardSettingValue } from "@lifeline/core";
import { TagPicker } from "./TagPicker";

/** Generic form for a Card's settings schema (ADR 0008). Entity fields call the App's live options hook. */
export function CardSettingsForm({
  schema,
  value,
  onChange,
}: {
  schema: CardSettingsSchema;
  value: CardSettings;
  onChange: (next: CardSettings) => void;
}) {
  return (
    <div className="grid gap-3">
      {Object.entries(schema).map(([key, field]) => (
        <div key={key} className="grid gap-1.5">
          <Label htmlFor={`cs-${key}`}>
            {field.label}
            {field.kind === "entity" && field.required && <span className="text-destructive"> *</span>}
          </Label>
          <Field id={`cs-${key}`} field={field} value={value[key]} onChange={(v) => onChange({ ...value, [key]: v })} />
        </div>
      ))}
    </div>
  );
}

const NONE = "__none__";

function Field({
  id,
  field,
  value,
  onChange,
}: {
  id: string;
  field: CardFieldDef;
  value: CardSettingValue | undefined;
  onChange: (v: CardSettingValue) => void;
}) {
  switch (field.kind) {
    case "number":
      return (
        <Input
          id={id}
          type="number"
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          value={typeof value === "number" ? value : field.default}
          onChange={(e) => {
            const n = e.target.valueAsNumber;
            if (Number.isFinite(n)) onChange(n);
          }}
        />
      );
    case "text":
      return <Input id={id} placeholder={field.placeholder} value={typeof value === "string" ? value : field.default} onChange={(e) => onChange(e.target.value)} />;
    case "select":
      return (
        <Select value={String(value ?? field.default)} onValueChange={onChange}>
          <SelectTrigger id={id} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "tags":
      return <TagPicker id={id} value={Array.isArray(value) ? value : []} onChange={onChange} placeholder="Any tag" />;
    case "entity":
      return <EntityField id={id} field={field} value={typeof value === "string" ? value : ""} onChange={onChange} />;
  }
}

function EntityField({
  id,
  field,
  value,
  onChange,
}: {
  id: string;
  field: Extract<CardFieldDef, { kind: "entity" }>;
  value: string;
  onChange: (v: string) => void;
}) {
  const options = field.useOptions();
  const known = options.some((o) => o.value === value);
  return (
    <Select value={value === "" ? NONE : value} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={field.required ? "Choose…" : (field.anyLabel ?? "Any")} />
      </SelectTrigger>
      <SelectContent>
        {!field.required && <SelectItem value={NONE}>{field.anyLabel ?? "Any"}</SelectItem>}
        {value !== "" && !known && (
          <SelectItem value={value} disabled>
            (unavailable)
          </SelectItem>
        )}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
