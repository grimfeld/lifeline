import { useId } from "react";
import { Checkbox, DatePicker, Field, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, TimeField } from "@lifeline/ui";
import type { CommandArg } from "@lifeline/core";

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
    default:
      return (
        <Field label={label} hint={arg.hint ?? kindHint(arg)} error={error}>
          <Input value={value === undefined ? "" : String(value)} onChange={(e) => onChange(e.target.value)} />
        </Field>
      );
  }
}

function kindHint(arg: CommandArg): string | undefined {
  switch (arg.kind) {
    case "list":
    case "multiselect":
      return arg.options ? `Comma-separated, among ${arg.options.map((o) => o.value).join(", ")}` : "Comma-separated";
    case "link":
      return "The title of the Document";
    case "json":
    case "rows":
      return "As JSON";
    default:
      return undefined;
  }
}
