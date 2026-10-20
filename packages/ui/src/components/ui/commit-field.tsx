import * as React from "react"

import { useCommitDraft } from "../../lib/useCommitDraft"
import { DatePicker } from "./date-picker"
import { Field } from "./field"
import { Input } from "./input"
import { Textarea } from "./textarea"

/**
 * A field edited in place, written once the edit is done: on leaving it or
 * Enter (a date as soon as a day is picked from the kit's Date picker), or — with `delay` — a moment after
 * the typing stops; Escape puts the stored value back. `onCommit` is the
 * owner's operation — when it refuses (throws), its message shows under the
 * field and the typed text stays, to be fixed. Until the field is being edited
 * it follows `value`, so a change made elsewhere shows. What is still typed
 * when it goes away (the Peek closed) is written.
 * Used where a Document is edited without a form to save (a Peek, ADR 0085);
 * the mechanism is `useCommitDraft`.
 */
function CommitField({
  label,
  value,
  onCommit,
  multiline,
  rows = 1,
  type = "text",
  delay,
  hint,
  className,
  placeholder,
  inputMode,
  min,
  max,
  step,
  required,
  startYear,
  endYear,
}: {
  label: React.ReactNode
  value: string
  onCommit: (next: string) => unknown
  multiline?: boolean
  /** A multiline field's height in lines. */
  rows?: number
  type?: "text" | "date" | "datetime-local" | "number" | "url"
  /** Write this many ms after the last keystroke, not only on leaving the field. */
  delay?: number
  hint?: React.ReactNode
  className?: string
  placeholder?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]
  min?: number | string
  max?: number | string
  step?: number | string
  /** A date that can't be cleared (no "Clear" in its picker). */
  required?: boolean
  /** A date's first year to offer (1900); earlier for historical dates. */
  startYear?: number
  /** A date's last year to offer (ten years from now). */
  endYear?: number
}) {
  const { draft, error, change, commit, revert } = useCommitDraft(value, onCommit, { delay })
  const onChange = (next: string) => {
    change(next)
    // A date is done once picked.
    if (type === "date") void commit()
  }
  const events = {
    onBlur: () => void commit(),
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        revert()
        e.currentTarget.blur()
      } else if (e.key === "Enter" && (!multiline || e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        e.currentTarget.blur()
      }
    },
  }
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {type === "date" ? (
        <DatePicker
          value={draft}
          onChange={onChange}
          min={min === undefined ? undefined : String(min)}
          max={max === undefined ? undefined : String(max)}
          required={required}
          startYear={startYear}
          endYear={endYear}
          placeholder={placeholder}
        />
      ) : multiline ? (
        <Textarea rows={rows} value={draft} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} {...events} />
      ) : (
        <Input
          type={type}
          value={draft}
          placeholder={placeholder}
          inputMode={inputMode}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(e.target.value)}
          {...events}
        />
      )}
    </Field>
  )
}

export { CommitField }
