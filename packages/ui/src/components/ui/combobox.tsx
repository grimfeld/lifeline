import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"
import { Popover as PopoverPrimitive } from "radix-ui"
import { Check, Plus } from "lucide-react"

import { cn } from "../../lib/utils"
import { Input } from "./input"
import { matchOptions, offersCreate, type ComboboxMatchable } from "./combobox-match"
import { CommandItem } from "./command"

export { comboboxKey, matchOptions, offersCreate } from "./combobox-match"

/** One choice in a Combobox. `label` is shown and matched; `keywords` (aliases) match too. */
export interface ComboboxOption extends ComboboxMatchable {
  /** A second, muted line under the label. */
  description?: React.ReactNode
  /** Something before the label (a cover, an icon). */
  icon?: React.ReactNode
  disabled?: boolean
}

export interface ComboboxProps<T extends ComboboxOption = ComboboxOption> {
  /** The chosen option's value, ticked in the list; leave it out for a picker that adds (chips). */
  value?: string | null
  /** A person picked an option (click, or arrows + Enter). */
  onValueChange: (value: string, option: T) => void
  /** The typed text, when the caller keeps it; otherwise the Combobox does, and clears it after a pick. */
  query?: string
  onQueryChange?: (query: string) => void
  /** Options known at once, matched against the query accent- and case-insensitively. */
  options?: readonly T[]
  /**
   * Options found elsewhere (an online lookup), shown after `options`, not matched again.
   * Debounced by `searchDelay`, aborted when the query moves on, silent when it fails;
   * an option whose value is already listed is dropped.
   */
  search?: (query: string, signal: AbortSignal) => Promise<readonly T[]>
  /** Milliseconds of quiet typing before `search` runs (default 350). */
  searchDelay?: number
  /**
   * Offer a "Create …" row when no option in `options` (label or keyword) is exactly the query.
   * `search` results never suppress it. Enter with only that row creates.
   */
  onCreate?: (query: string) => void
  /** The Create row's text (default `Create “…”`). */
  createLabel?: (query: string) => React.ReactNode
  /** Where the Create row sits; `first` makes plain Enter create (a quick add), arrows reach the rest. */
  createPosition?: "first" | "last"
  /** At most this many rows are listed: the best matches of `options` first, then what `search` found. */
  limit?: number
  /** What the list is called to a screen reader (default "Suggestions"). */
  listLabel?: string
  /** Before the input (a search icon); the input pads for it. */
  leading?: React.ReactNode
  id?: string
  placeholder?: string
  autoFocus?: boolean
  "aria-label"?: string
  className?: string
  /** Runs before the Combobox's own keys (Backspace on an empty query to drop a chip, say). */
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>
}

const CREATE = "\u0000create"
/** Shortest query `search` is asked for. */
const SEARCH_MIN_LENGTH = 3

/**
 * Search-as-you-type picker (ADR 0079): an input, and under it a list you
 * arrow through and pick from with Enter. Options are data — local ones
 * matched the way Wikilinks resolve, plus an optional async `search` — and
 * an optional "Create …" row when nothing matches exactly. The list opens as
 * you type and stays shut while nothing matches. Announced as a
 * combobox with a listbox of options. On a phone the list is as wide as the
 * input and as tall as the room left above the keyboard.
 */
function Combobox<T extends ComboboxOption>({
  value,
  onValueChange,
  query: queryProp,
  onQueryChange,
  options = [],
  search,
  searchDelay = 350,
  onCreate,
  createLabel = (q) => <>Create “{q}”</>,
  createPosition = "last",
  limit,
  listLabel = "Suggestions",
  leading,
  id,
  placeholder,
  autoFocus,
  "aria-label": ariaLabel,
  className,
  onKeyDown,
}: ComboboxProps<T>) {
  const [ownQuery, setOwnQuery] = React.useState("")
  const query = queryProp ?? ownQuery
  const setQuery = (q: string) => {
    setOwnQuery(q)
    onQueryChange?.(q)
  }
  const [focused, setFocused] = React.useState(false)
  const [dismissed, setDismissed] = React.useState(false)
  const [found, setFound] = React.useState<readonly T[]>([])
  const [active, setActive] = React.useState("")
  const [list, setList] = React.useState<HTMLDivElement | null>(null)
  const [activeId, setActiveId] = React.useState<string>()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const anchorRef = React.useRef<HTMLDivElement>(null)

  const typed = query.trim()
  React.useEffect(() => {
    if (!search || typed.length < SEARCH_MIN_LENGTH) {
      setFound([])
      return
    }
    const ctl = new AbortController()
    const t = setTimeout(() => {
      search(typed, ctl.signal)
        .then((res) => {
          if (!ctl.signal.aborted) setFound(res)
        })
        .catch(() => {})
    }, searchDelay)
    return () => {
      clearTimeout(t)
      ctl.abort()
    }
    // `search` is usually an inline closure; the query drives the lookup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed, searchDelay])

  const rows = React.useMemo(() => {
    const local = typed ? matchOptions(options, typed) : []
    const seen = new Set(local.map((o) => o.value))
    return [...local, ...found.filter((o) => !seen.has(o.value) && (seen.add(o.value), true))].slice(0, limit)
  }, [options, typed, found, limit])
  const create = !!onCreate && offersCreate(options, typed)
  const byValue = React.useMemo(() => new Map(rows.map((o) => [o.value, o])), [rows])

  const hasRows = rows.length > 0 || create
  const open = focused && !dismissed && typed !== "" && hasRows

  // What Enter picks: the first row whenever the rows change (cmdk keeps it on arrows).
  const firstRow = createPosition === "first" && create ? CREATE : (rows.find((o) => !o.disabled)?.value ?? (create ? CREATE : ""))
  React.useEffect(() => setActive(firstRow), [firstRow, typed])
  // cmdk ids its rows itself; read the highlighted one's id back for aria-activedescendant.
  React.useLayoutEffect(() => {
    const row = active && list ? list.querySelector<HTMLElement>(`[cmdk-item][data-value="${CSS.escape(active)}"]`) : null
    setActiveId(row?.id || undefined)
  }, [list, active, rows, create])

  function pick(v: string) {
    if (v === CREATE) onCreate?.(typed)
    else {
      const o = byValue.get(v)
      if (!o) return
      onValueChange(o.value, o)
    }
    if (queryProp === undefined || onQueryChange) setQuery("")
    setFound([])
    inputRef.current?.focus()
  }

  const createRow = create && (
    <ComboboxRow key={CREATE} value={CREATE} onSelect={pick}>
      <Plus />
      <span className="min-w-0 flex-1 truncate">{createLabel(typed)}</span>
    </ComboboxRow>
  )

  return (
    <CommandPrimitive
      shouldFilter={false}
      value={active}
      onValueChange={setActive}
      loop
      className={cn("relative", className)}
      onKeyDown={(e) => {
        // A dismissed list comes back on ArrowDown, as a select's would.
        if (!open && e.key === "ArrowDown" && hasRows) {
          e.preventDefault()
          setDismissed(false)
        }
      }}
    >
      <PopoverPrimitive.Root open={open} onOpenChange={(o) => !o && setDismissed(true)}>
        <PopoverPrimitive.Anchor asChild>
          <div ref={anchorRef} className="relative">
            {leading && <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 flex -translate-y-1/2 [&_svg]:size-4">{leading}</span>}
            <ComboboxInput
              ref={inputRef}
              open={open}
              listId={list?.id}
              activeId={activeId}
              id={id}
              value={query}
              placeholder={placeholder}
              autoFocus={autoFocus}
              aria-label={ariaLabel}
              className={cn(leading && "pl-8")}
              onChange={(e) => {
                setQuery(e.target.value)
                setDismissed(false)
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => {
                setFocused(false)
                setDismissed(false)
              }}
              onKeyDown={(e) => {
                onKeyDown?.(e)
                if (e.defaultPrevented) return
                if (e.key === "Enter" && !open && create) {
                  e.preventDefault()
                  pick(CREATE)
                }
              }}
            />
          </div>
        </PopoverPrimitive.Anchor>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            data-slot="combobox-content"
            side="bottom"
            align="start"
            sideOffset={4}
            collisionPadding={8}
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
            onInteractOutside={(e) => {
              if (anchorRef.current?.contains(e.target as Node)) e.preventDefault()
            }}
            // Keep the caret in the input while a row is pressed.
            onMouseDown={(e) => e.preventDefault()}
            className="bg-popover text-popover-foreground z-50 w-(--radix-popover-trigger-width) max-w-[calc(100vw-1rem)] overflow-hidden rounded-lg border p-0 shadow-md outline-none data-open:animate-in data-open:fade-in-0"
          >
            <CommandPrimitive.List
              ref={setList}
              data-slot="command-list"
              label={listLabel}
              className="max-h-[min(18rem,var(--radix-popover-content-available-height))] scroll-py-1 overflow-x-hidden overflow-y-auto p-1"
            >
              {createPosition === "first" && createRow}
              {rows.map((o) => (
                <ComboboxRow key={o.value} value={o.value} disabled={o.disabled} onSelect={pick}>
                  {o.icon}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{o.label}</span>
                    {o.description && <span className="text-muted-foreground block truncate text-xs">{o.description}</span>}
                  </span>
                  {value != null && o.value === value && <Check className="ml-auto" />}
                </ComboboxRow>
              ))}
              {createPosition === "last" && createRow}
            </CommandPrimitive.List>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </CommandPrimitive>
  )
}

/** The input, announced as a combobox owning the list, with the highlighted row as its active descendant. */
function ComboboxInput({ open, listId, activeId, ...props }: React.ComponentProps<typeof Input> & { open: boolean; listId?: string; activeId?: string }) {
  return (
    <Input
      role="combobox"
      aria-expanded={open}
      aria-controls={open ? listId : undefined}
      aria-autocomplete="list"
      aria-activedescendant={open ? activeId : undefined}
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      {...props}
    />
  )
}

/** A row: thumb-sized on a phone. */
const ComboboxRow = (props: React.ComponentProps<typeof CommandItem>) => <CommandItem {...props} className={cn("min-h-8 max-md:min-h-10", props.className)} />

export { Combobox }
