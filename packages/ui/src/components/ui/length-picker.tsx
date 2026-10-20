import { useState } from "react";
import { cn } from "../../lib/utils";
import { Button } from "./button";
import { Input } from "./input";
import { formatLength, parseLength } from "./length-value";

export { formatLength, parseLength } from "./length-value";

/** The lengths offered as one tap each, in minutes. */
export const LENGTH_PICKS = [15, 30, 45, 60, 90, 120];

/**
 * How long something takes, in minutes: a chip per common length and a field
 * for any other ("2h 15m", "1d 4h", "100"). Work, Estimates and templates are
 * given a length this way; an Event is given an end instead.
 *
 * With `clearable` the value may be null — "none" — through the None chip,
 * tapping the chosen chip again, or emptying the field. Without it a length
 * is always set. The field writes on blur or Enter; text it can't read
 * reverts.
 */
export function LengthPicker({
  value,
  onChange,
  clearable = false,
  id,
  className,
  "aria-label": ariaLabel = "Length",
}: {
  value: number | null;
  onChange: (min: number | null) => void;
  clearable?: boolean;
  /** Given to the custom field, so a `Label htmlFor` names it. */
  id?: string;
  className?: string;
  "aria-label"?: string;
}) {
  /** What is typed while the field is being edited; null when it shows the value. */
  const [draft, setDraft] = useState<string | null>(null);
  const custom = value !== null && !LENGTH_PICKS.includes(value);
  const shown = draft ?? (custom ? formatLength(value) : "");

  function commit() {
    if (draft === null) return;
    const text = draft.trim();
    setDraft(null);
    if (!text) {
      if (clearable && custom) onChange(null);
      return;
    }
    const n = parseLength(text);
    if (n !== null && n !== value) onChange(n);
  }

  return (
    <div role="group" aria-label={ariaLabel} data-slot="length-picker" className={cn("flex min-w-0 flex-wrap items-center gap-1.5", className)}>
      {clearable && (
        <Button type="button" size="sm" variant={value === null ? "default" : "outline"} aria-pressed={value === null} onClick={() => onChange(null)}>
          None
        </Button>
      )}
      {LENGTH_PICKS.map((m) => (
        <Button
          key={m}
          type="button"
          size="sm"
          className="tabular-nums"
          variant={value === m ? "default" : "outline"}
          aria-pressed={value === m}
          onClick={() => onChange(clearable && value === m ? null : m)}
        >
          {formatLength(m)}
        </Button>
      ))}
      <Input
        id={id}
        inputMode="text"
        autoComplete="off"
        placeholder="Other…"
        aria-label={`${ariaLabel}, other`}
        className={cn("w-24 tabular-nums", custom && draft === null && "border-primary")}
        value={shown}
        onFocus={(e) => setDraft(e.currentTarget.value)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape" && draft !== null) {
            e.stopPropagation();
            setDraft(null);
          }
        }}
      />
    </div>
  );
}
