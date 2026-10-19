import * as React from "react"

import { cn } from "../../lib/utils"
import { Label } from "./label"

type ControlProps = {
  id?: string
  "aria-describedby"?: string
  "aria-invalid"?: React.AriaAttributes["aria-invalid"]
}

/**
 * A form field: its Label, the control, an optional hint and an optional error
 * (CODING_STANDARDS.md § Forms and feedback). The control is the one child; the
 * Field gives it an id for the Label (or uses the one it has), names the hint and
 * error as its description, and sets `aria-invalid` while there is an error — so
 * the kit's invalid styling shows and a screen reader reads the message with it.
 */
function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: React.ReactNode
  hint?: React.ReactNode
  /** What is wrong with the value, shown under the control. Empty = valid. */
  error?: React.ReactNode
  className?: string
  children: React.ReactElement<ControlProps>
}) {
  const auto = React.useId()
  const control = children.props
  const id = control.id ?? auto
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy =
    [control["aria-describedby"], hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined
  return (
    <div data-slot="field" className={cn("grid gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {React.cloneElement(children, {
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : control["aria-invalid"],
      })}
      {hint && (
        <p id={hintId} data-slot="field-hint" className="text-muted-foreground text-xs">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} data-slot="field-error" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  )
}

export { Field }
