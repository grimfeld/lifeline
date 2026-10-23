import * as React from "react"
import { Check, Clock } from "lucide-react"

import { cn } from "../../lib/utils"
import { Input } from "./input"
import { Popover, PopoverAnchor, PopoverContent } from "./popover"
import { formatTimeValue, minutesOf, nextQuarter, parseTimeText, QUARTER_HOURS, stepTime } from "./time-value"

/**
 * A time of day typed or picked from the kit, never the browser's time input:
 * a field you type into ("14:30", "1430", "930", "9", "2pm") that opens a list
 * of quarter hours in the kit Popover, scrolled to the value or to the next
 * quarter hour. Typed minutes stay as typed; text that isn't a time reverts.
 * Arrow up and down step 15 minutes; while the list is open they move through
 * it instead (announced with `aria-activedescendant`), and Enter picks.
 * Alt+Arrow down opens the list, Alt+Arrow up closes it. Shown in the browser's 12h or 24h clock.
 * Value in and out is the native time input's string — `HH:MM`, `""` for none
 * — so nothing stored changes. A `Field` child: it takes the Field's id,
 * description and invalid state.
 */
function TimeField({
  value,
  onChange,
  required,
  disabled,
  placeholder,
  locale,
  className,
  id,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: {
  value: string
  onChange: (value: string) => void
  /** A required time can't be cleared: emptying the text reverts it. */
  required?: boolean
  disabled?: boolean
  /** Shown, muted, when no time is set ("No time" by default). */
  placeholder?: string
  /** The clock (12h or 24h) and text; the browser's locale by default. */
  locale?: string
  className?: string
  id?: string
  "aria-label"?: string
  "aria-labelledby"?: string
  "aria-describedby"?: string
  "aria-invalid"?: React.AriaAttributes["aria-invalid"]
}) {
  const [open, setOpenState] = React.useState(false)
  /** The highlighted row while the list is open; null until the arrows move it (then it's the target). */
  const [active, setActive] = React.useState<string | null>(null)
  /** What is being typed; null while the field shows the value. */
  const [draft, setDraft] = React.useState<string | null>(null)
  const anchorRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listId = React.useId()
  const shown = formatTimeValue(value, locale)
  const listOpen = open && !disabled
  const highlighted = active ?? listTarget(value)
  const setOpen = (next: boolean | ((o: boolean) => boolean)) => {
    setOpenState(next)
    setActive(null)
  }

  const change = (next: string) => {
    if (next !== value) onChange(next)
  }
  /** Read the typed text: a time is kept, anything else reverts to the value. */
  const commit = () => {
    if (draft === null) return
    const next = parseTimeText(draft)
    setDraft(null)
    if (next !== null && !(next === "" && required)) change(next)
  }
  const pick = (next: string) => {
    setDraft(null)
    setOpen(false)
    change(next)
    inputRef.current?.focus()
  }

  return (
    <Popover open={listOpen} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div ref={anchorRef} data-slot="time-field" className={cn("relative w-full min-w-0", className)}>
          <Input
            ref={inputRef}
            id={id}
            role="combobox"
            aria-expanded={listOpen}
            aria-controls={listOpen ? listId : undefined}
            aria-activedescendant={listOpen ? optionId(listId, highlighted) : undefined}
            aria-haspopup="listbox"
            aria-autocomplete="none"
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            aria-describedby={ariaDescribedBy}
            aria-invalid={ariaInvalid}
            aria-required={required || undefined}
            disabled={disabled}
            inputMode="text"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder={placeholder ?? "No time"}
            value={draft ?? shown}
            className="pr-8 tabular-nums"
            onChange={(e) => {
              setDraft(e.target.value)
              setOpen(false)
            }}
            onClick={() => setOpen((o) => !o)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                e.preventDefault()
                if (e.altKey) return setOpen(e.key === "ArrowDown")
                if (listOpen) return setActive(moveQuarter(highlighted, e.key === "ArrowUp" ? -1 : 1))
                const from = draft === null ? value : (parseTimeText(draft) ?? value)
                setDraft(null)
                change(stepTime(from, e.key === "ArrowUp" ? 15 : -15))
              } else if (e.key === "Enter" && listOpen) {
                e.preventDefault()
                pick(highlighted)
              } else if (e.key === "Enter" && draft !== null) {
                e.preventDefault()
                commit()
              } else if (e.key === "Escape" && (open || draft !== null)) {
                // Escape backs out of the list or the typing, not the Dialog or Peek under it.
                e.preventDefault()
                e.stopPropagation()
                setOpen(false)
                setDraft(null)
              }
            }}
          />
          <Clock className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2" aria-hidden />
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) min-w-32 p-1"
        align="start"
        // The caret stays in the field: typing goes on while the list is open.
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          if (anchorRef.current?.contains(e.target as Node)) e.preventDefault()
        }}
        onEscapeKeyDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.preventDefault()}
      >
        <TimeList id={listId} value={value} active={highlighted} locale={locale} onPick={pick} onHover={setActive} />
      </PopoverContent>
    </Popover>
  )
}

/** The row the list opens on: the value's quarter hour (an odd "09:10" lands on the quarter before it), or the next quarter hour. */
function listTarget(value: string): string {
  const minutes = minutesOf(value)
  const quarter = minutes === undefined ? undefined : QUARTER_HOURS[Math.floor(minutes / 15)]
  return quarter ?? nextQuarter(new Date())
}

/** The row `by` rows away, stopping at the first and last. */
function moveQuarter(from: string, by: number): string {
  const i = QUARTER_HOURS.indexOf(from)
  return QUARTER_HOURS[Math.min(QUARTER_HOURS.length - 1, Math.max(0, i + by))] ?? from
}

const optionId = (listId: string, time: string) => `${listId}-${time.replace(":", "")}`

/** The quarter hours, the highlighted row (at first the value, or the next quarter hour) scrolled into view. */
function TimeList({
  id,
  value,
  active,
  locale,
  onPick,
  onHover,
}: {
  id: string
  value: string
  active: string
  locale?: string
  onPick: (value: string) => void
  onHover: (value: string) => void
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  // Centred once the list opens, on its first row; later moves only scroll as far as they must.
  const opened = React.useRef(active)
  const target = opened.current
  React.useLayoutEffect(() => {
    const list = ref.current
    if (!list) return
    const center = () => {
      const row = list.querySelector<HTMLElement>(`[data-time="${target}"]`)
      if (row) list.scrollTop = row.offsetTop - list.clientHeight / 2 + row.offsetHeight / 2
    }
    center()
    // The popover is placed (and the list's height capped) after it mounts: centre again once it has its size.
    const observer = new ResizeObserver(center)
    observer.observe(list)
    return () => observer.disconnect()
  }, [target])
  React.useEffect(() => {
    if (active === target) return
    ref.current?.querySelector<HTMLElement>(`[data-time="${active}"]`)?.scrollIntoView?.({ block: "nearest" })
  }, [active, target])
  return (
    <div
      ref={ref}
      id={id}
      role="listbox"
      aria-label="Times"
      className="relative max-h-[min(16rem,var(--radix-popover-content-available-height))] overflow-y-auto overscroll-contain"
    >
      {QUARTER_HOURS.map((t) => (
        <div
          key={t}
          id={optionId(id, t)}
          role="option"
          aria-selected={t === value}
          data-time={t}
          data-active={t === active || undefined}
          className="data-active:bg-accent data-active:text-accent-foreground aria-selected:font-medium flex min-h-8 cursor-default items-center justify-between gap-2 rounded-md px-2 text-sm tabular-nums select-none max-md:min-h-10"
          onClick={() => onPick(t)}
          onMouseMove={() => t !== active && onHover(t)}
        >
          {formatTimeValue(t, locale)}
          {t === value && <Check className="size-4" aria-hidden />}
        </div>
      ))}
    </div>
  )
}

export { TimeField }
