import * as React from "react"

import { Field } from "./field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"

const NONE = "__none__"

/**
 * A single choice among an owner's own options, written as soon as it is
 * picked; "" is none (offered only when `optional`). Beside `CommitField`: when
 * `onCommit` refuses (throws), its message shows under the field.
 */
function ChoiceField({
  label,
  value,
  options,
  onCommit,
  optional,
  hint,
  className,
}: {
  label: string
  value: string
  options: readonly { value: string; label: string }[]
  onCommit: (next: string) => unknown
  optional?: boolean
  hint?: React.ReactNode
  className?: string
}) {
  const [error, setError] = React.useState("")
  const pick = async (next: string) => {
    try {
      await onCommit(next)
      setError("")
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      <ChoiceSelect label={label} value={value} options={options} optional={optional} onPick={(v) => void pick(v)} />
    </Field>
  )
}

/** The Select, taking the id and descriptions `Field` hands its control onto its trigger. */
function ChoiceSelect({
  label,
  value,
  options,
  optional,
  onPick,
  ...control
}: {
  label: string
  value: string
  options: readonly { value: string; label: string }[]
  optional?: boolean
  onPick: (next: string) => void
  id?: string
  "aria-describedby"?: string
  "aria-invalid"?: React.AriaAttributes["aria-invalid"]
}) {
  return (
    <Select value={value || NONE} onValueChange={(v) => onPick(v === NONE ? "" : v)}>
      <SelectTrigger {...control} aria-label={label} className="w-full min-w-0">
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        {(optional || !value) && <SelectItem value={NONE}>—</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export { ChoiceField }
