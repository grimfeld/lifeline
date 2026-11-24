import { useId } from "react";
import { Checkbox, DatePicker, Field, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, TimeField } from "@lifeline/ui";
import { PERSON_TYPE, type CommandArg } from "@lifeline/core";
import { LinksField, PeopleField } from "@lifeline/editor";

const NONE = "\u0000none";

/** An argument's name as a form shows it: marked when it must be given. */
export function argLabel(arg: CommandArg): string {
  return arg.required ? `${arg.label} (required)` : arg.label;
}

/** One argument's value, entered in the control its kind calls for; `error` shows under it (CODING_STANDARDS.md § Forms). */
export function ArgInput({ arg, value, error, onChange }: { arg: CommandArg; value: unknown; error?: string; onChange: (v: unknown) => void }) {
  const id = useId();
  const label = argLabel(arg);
  switch (arg.kind) {
    case "boolean":
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id={id}
              checked={value === true}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              onCheckedChange={(c) => onChange(c === true ? true : undefined)}
            />
            <Label htmlFor={id}>{label}</Label>
          </div>
          {error && (
            <p id={`${id}-error`} className="text-destructive text-xs">
              {error}
            </p>
          )}
        </div>
      );
    case "date":
      return (
        <Field label={label} hint={arg.hint} error={error}>
          <DatePicker value={typeof value === "string" ? value : ""} onChange={(v) => onChange(v || undefined)} />
        </Field>
      );
    case "time":
      return (
        <Field label={label} hint={arg.hint} error={error}>
          <TimeField value={typeof value === "string" ? value : ""} onChange={(v) => onChange(v || undefined)} />
        </Field>
      );
    case "select":
      return (
        <Field label={label} hint={arg.hint} error={error}>
          <Select value={typeof value === "string" ? value : NONE} onValueChange={(v) => onChange(v === NONE ? undefined : v)}>
            <SelectTrigger className="w-full min-w-0" aria-label={label}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Not set</SelectItem>
              {arg.options?.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  <span className="truncate">{o.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      );
    case "links":
      // A list of People is picked as a People field picks them (completing names and aliases); any other list (a Memory's About) as a Links field is.
      return arg.linkType === PERSON_TYPE ? (
        <Field label={label} hint={arg.hint} error={error}>
          <PeopleField label={label} placeholder="Add a person…" value={entries(value)} onChange={(ids) => onChange(ids.length ? ids : undefined)} />
        </Field>
      ) : (
        <Field label={label} hint={arg.hint} error={error}>
          <LinksField id={id} linkType={arg.linkType} linkRole={arg.linkRole} value={entries(value)} onChange={(v) => onChange(Array.isArray(v) && v.length ? v : undefined)} />
        </Field>
      );
    default:
      return (
        <Field label={label} hint={arg.hint ?? kindHint(arg)} error={error}>
          <Input value={value === undefined ? "" : String(value)} onChange={(e) => onChange(e.target.value)} />
        </Field>
      );
  }
}

/** A list value as its entries: a list as it is, or a single text as its one entry. */
function entries(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  return typeof value === "string" && value.trim() ? [value.trim()] : [];
}

function kindHint(arg: CommandArg): string | undefined {
  switch (arg.kind) {
    case "link":
      return "The title of the Document, an alias or its id";
    case "list":
    case "multiselect":
      return arg.options ? `Comma-separated, among ${arg.options.map((o) => o.value).join(", ")}` : "Comma-separated";
    case "json":
    case "rows":
      return "As JSON";
    default:
      return undefined;
  }
}
