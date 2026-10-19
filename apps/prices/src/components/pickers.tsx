import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@lifeline/ui";
import type { AriaAttributes } from "react";
import { unitName } from "../domain/measure";
import { type Product, type Shop } from "../domain/types";

/** Radix Select refuses "" as an item value; these stand in for "none" and "make a new one". */
export const NONE = "__none__";
export const NEW = "__new__";

export function ShopSelect({ value, onChange, shops, onNew, placeholder = "Pick a shop", className }: { value: string; onChange: (id: string) => void; shops: readonly Shop[]; onNew?: () => void; placeholder?: string; className?: string }) {
  return (
    <Select
      value={value || undefined}
      onValueChange={(v) => {
        if (v === NEW) onNew?.();
        else onChange(v);
      }}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {shops.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.title}
          </SelectItem>
        ))}
        {onNew && <SelectItem value={NEW}>＋ New shop…</SelectItem>}
      </SelectContent>
    </Select>
  );
}

export function ProductSelect({ value, onChange, products, onNew, allowNone, className }: { value: string; onChange: (id: string) => void; products: readonly Product[]; onNew?: () => void; /** Offer "Unmatched" (the inbox) as a choice. */ allowNone?: boolean; className?: string }) {
  return (
    <Select
      value={value || (allowNone ? NONE : undefined)}
      onValueChange={(v) => {
        if (v === NEW) onNew?.();
        else onChange(v === NONE ? "" : v);
      }}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder="Pick a product" />
      </SelectTrigger>
      <SelectContent>
        {allowNone && (
          <SelectItem value={NONE}>
            <span className="text-muted-foreground">Unmatched</span>
          </SelectItem>
        )}
        {products.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.title} <span className="text-muted-foreground">· {unitName(p)}</span>
          </SelectItem>
        ))}
        {onNew && <SelectItem value={NEW}>＋ New product…</SelectItem>}
      </SelectContent>
    </Select>
  );
}

/**
 * One choice among a few named options — a dimension, a reading unit,
 * compare-by. Takes the id, description and invalid mark a `Field` hands its
 * control and puts them on the trigger, so the Field's label names it.
 */
export function UnitSelect<T extends string>({
  value,
  onChange,
  options,
  disabled,
  id,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string }[];
  disabled?: boolean;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: AriaAttributes["aria-invalid"];
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)} disabled={disabled}>
      <SelectTrigger id={id} aria-describedby={describedBy} aria-invalid={invalid} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
