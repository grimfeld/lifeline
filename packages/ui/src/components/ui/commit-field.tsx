import * as React from "react"

import { Field } from "./field"
import { Input } from "./input"
import { Textarea } from "./textarea"

/**
 * A field edited in place, written once the edit is done: on leaving it or
 * Enter (a date as soon as one is picked); Escape puts the stored value back.
 * `onCommit` is the owner's operation — when it refuses (throws), its message
 * shows under the field and the typed text stays, to be fixed. Until the field
 * is being edited it follows `value`, so a change made elsewhere shows.
 * Used where a Document is edited without a form to save (a Peek, ADR 0085).
 */
function CommitField({
  label,
  value,
  onCommit,
  multiline,
  type = "text",
  hint,
  className,
  placeholder,
  inputMode,
}: {
  label: React.ReactNode
  value: string
  onCommit: (next: string) => unknown
  multiline?: boolean
  type?: "text" | "date"
  hint?: React.ReactNode
  className?: string
  placeholder?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]
}) {
  const [draft, setDraft] = React.useState(value)
  const [error, setError] = React.useState("")
  const editing = React.useRef(false)
  const latest = React.useRef({ draft: value, value, onCommit })
  latest.current = { ...latest.current, value, onCommit }

  React.useEffect(() => {
    if (editing.current) return
    latest.current.draft = value
    setDraft(value)
  }, [value])

  const commit = React.useCallback(async () => {
    const { draft: next, value: stored, onCommit: write } = latest.current
    if (next === stored) return setError("")
    try {
      await write(next)
      setError("")
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  // Closed mid-edit (the Peek dismissed while typing): what was typed is still written.
  React.useEffect(
    () => () => {
      if (editing.current) void commit()
    },
    [commit],
  )

  const change = (next: string) => {
    latest.current.draft = next
    setDraft(next)
    if (type === "date") void commit()
  }
  const events = {
    onFocus: () => (editing.current = true),
    onBlur: () => {
      editing.current = false
      void commit()
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        latest.current.draft = latest.current.value
        setDraft(latest.current.value)
        setError("")
        e.currentTarget.blur()
      } else if (e.key === "Enter" && (!multiline || e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        e.currentTarget.blur()
      }
    },
  }
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {multiline ? (
        <Textarea rows={1} value={draft} placeholder={placeholder} onChange={(e) => change(e.target.value)} {...events} />
      ) : (
        <Input type={type} value={draft} placeholder={placeholder} inputMode={inputMode} onChange={(e) => change(e.target.value)} {...events} />
      )}
    </Field>
  )
}

export { CommitField }
