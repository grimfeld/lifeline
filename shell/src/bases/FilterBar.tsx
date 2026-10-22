import { useState } from "react";
import { Button, DatePicker, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@lifeline/ui";
import { COMMON_COLUMNS, type DocumentTypeDef, type FieldDef, type ViewFilter, type ViewFilterOp } from "@lifeline/core";
import { Plus, X } from "lucide-react";

const OPS: { value: ViewFilterOp; label: string; needsValue: boolean }[] = [
  { value: "eq", label: "is", needsValue: true },
  { value: "neq", label: "is not", needsValue: true },
  { value: "contains", label: "contains", needsValue: true },
  { value: "anyOf", label: "any of", needsValue: true },
  { value: "gt", label: ">", needsValue: true },
  { value: "lt", label: "<", needsValue: true },
  { value: "empty", label: "is empty", needsValue: false },
  { value: "notEmpty", label: "is set", needsValue: false },
];

function filterableFields(def: DocumentTypeDef | undefined): FieldDef[] {
  return [...COMMON_COLUMNS.filter((c) => c.key !== "updatedAt"), ...(def?.fields ?? []).filter((f) => !f.hidden && f.kind !== "json")];
}

function describe(f: ViewFilter, def: DocumentTypeDef | undefined): string {
  const field = filterableFields(def).find((x) => x.key === f.field);
  const op = OPS.find((o) => o.value === f.op);
  const v = Array.isArray(f.value) ? f.value.join(", ") : f.value === undefined ? "" : String(f.value);
  const opt = field?.options?.find((o) => o.value === v);
  return `${field?.label ?? f.field} ${op?.label ?? f.op}${op?.needsValue ? ` ${opt?.label ?? v}` : ""}`;
}

/** Filter chips + an inline "add filter" row (field · op · value). */
export function FilterBar({ def, filters, onChange }: { def: DocumentTypeDef | undefined; filters: ViewFilter[]; onChange: (next: ViewFilter[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<ViewFilter>({ field: "title", op: "contains", value: "" });
  const fields = filterableFields(def);
  const field = fields.find((f) => f.key === draft.field);
  const op = OPS.find((o) => o.value === draft.op)!;
  /** Add the filter being built; `picked` is a value chosen just now (a date), not yet in the draft. */
  function commit(picked?: ViewFilter["value"]) {
    let value = picked ?? draft.value;
    if (op.needsValue && (value === "" || value === undefined)) return;
    if (draft.op === "anyOf" && typeof value === "string") value = value.split(",").map((s) => s.trim()).filter(Boolean);
    if (field?.kind === "number" && typeof value === "string") value = Number(value);
    if (field?.kind === "boolean") value = value === "true" || value === true;
    onChange([...filters, { ...draft, value }]);
    setAdding(false);
    setDraft({ field: "title", op: "contains", value: "" });
  }
  return (
    <div className="flex flex-wrap items-center gap-1">
      {filters.map((f, i) => (
        <span key={i} className="bg-muted inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs">
          {describe(f, def)}
          <button type="button" className="hover:text-destructive" onClick={() => onChange(filters.filter((_, j) => j !== i))} aria-label="Remove filter">
            <X className="size-3" />
          </button>
        </span>
      ))}
      {adding ? (
        <span className="flex items-center gap-1">
          <Select value={draft.field} onValueChange={(v) => setDraft({ ...draft, field: v, value: "" })}>
            <SelectTrigger size="sm" className="w-32 text-xs" aria-label="Field">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {fields.map((f) => (
                <SelectItem key={f.key} value={f.key}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={draft.op} onValueChange={(v) => setDraft({ ...draft, op: v as ViewFilterOp })}>
            <SelectTrigger size="sm" className="w-28 text-xs" aria-label="Condition">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {op.needsValue &&
            (field?.kind === "select" && draft.op !== "contains" ? (
              <Select value={String(draft.value ?? "")} onValueChange={(v) => setDraft({ ...draft, value: v })}>
                <SelectTrigger size="sm" className="w-32 text-xs">
                  <SelectValue placeholder="value" />
                </SelectTrigger>
                <SelectContent>
                  {(field.options ?? []).map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : field?.kind === "boolean" ? (
              <Select value={String(draft.value ?? "true")} onValueChange={(v) => setDraft({ ...draft, value: v })}>
                <SelectTrigger size="sm" className="w-24 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">yes</SelectItem>
                  <SelectItem value="false">no</SelectItem>
                </SelectContent>
              </Select>
            ) : field?.kind === "date" ? (
              // A date is done once picked: picking adds the filter, as Enter does in a typed value.
              <DatePicker size="sm" className="w-36" value={typeof draft.value === "string" ? draft.value : ""} onChange={(v) => commit(v)} aria-label="Value" />
            ) : (
              <Input
                className="w-36 text-xs"
                type={field?.kind === "number" ? "number" : "text"}
                placeholder={draft.op === "anyOf" ? "a, b, c" : "value"}
                value={String(draft.value ?? "")}
                onChange={(e) => setDraft({ ...draft, value: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && commit()}
                autoFocus
              />
            ))}
          <Button size="sm" onClick={() => commit()}>
            Add
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
            Cancel
          </Button>
        </span>
      ) : (
        <Button size="sm" variant="ghost" className="text-xs" onClick={() => setAdding(true)}>
          <Plus className="size-3" /> Filter
        </Button>
      )}
    </div>
  );
}
