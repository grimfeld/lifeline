import { useEffect, useId, useRef, useState, type AriaAttributes, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

/** Default normaliser: trim, drop `#`, lower-case, spaces → `-`. Callers may pass a stricter one. */
export function defaultNormalizeTag(raw: string): string | null {
  const t = trimSeparators(raw.trim().replace(/^#/, "").toLowerCase().replace(/\s+/g, "-"));
  return t ? t : null;
}

/** Leading and trailing `/` and `-` cut by hand: `[/-]+$` is quadratic on a long run of them. */
function trimSeparators(t: string): string {
  const sep = (c: string) => c === "/" || c === "-";
  let from = 0;
  let to = t.length;
  while (from < to && sep(t.charAt(from))) from++;
  while (to > from && sep(t.charAt(to - 1))) to--;
  return t.slice(from, to);
}

export interface TagInputProps {
  id?: string;
  value: readonly string[];
  onChange: (tags: string[]) => void;
  /** Known tags offered as suggestions (typically the derived vocabulary). */
  suggestions?: readonly string[];
  placeholder?: string;
  normalize?: (raw: string) => string | null;
  className?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  /** Set by `Field`: its hint and error, read with the input. */
  "aria-describedby"?: string;
  "aria-invalid"?: AriaAttributes["aria-invalid"];
}

/**
 * Chip/token editor for Tags (ADR 0014). Enter, comma or Tab commits the
 * typed word; Backspace on an empty input removes the last chip; typing
 * filters `suggestions`, Arrow keys + Enter pick one. The input is a combobox:
 * the highlighted suggestion is its `aria-activedescendant`.
 */
export function TagInput({ id, value, onChange, suggestions = [], placeholder = "Add tag…", normalize = defaultNormalizeTag, className, autoFocus, disabled, "aria-describedby": describedBy, "aria-invalid": invalid }: TagInputProps) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [activeAt, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const optionId = (i: number) => `${listId}-${i}`;

  const q = text.trim().replace(/^#/, "").toLowerCase();
  const matches = suggestions.filter((s) => !value.includes(s) && (q === "" || s.includes(q))).slice(0, 8);
  const shown = open && matches.length > 0;
  // Suggestions shrink as tags are added: the highlight stays on the last one left.
  const active = Math.min(activeAt, Math.max(matches.length - 1, 0));

  useEffect(() => {
    if (shown) listRef.current?.children[active]?.scrollIntoView?.({ block: "nearest" });
  }, [shown, active]);

  const add = (raw: string) => {
    const t = normalize(raw);
    if (!t) return;
    if (!value.includes(t)) onChange([...value, t]);
    setText("");
    setActive(0);
  };
  const removeAt = (i: number) => onChange(value.filter((_, j) => j !== i));

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || (e.key === "Tab" && text !== "")) {
      if (shown && matches[active] && (text === "" || e.key !== ",")) {
        e.preventDefault();
        add(matches[active]);
        return;
      }
      if (text.trim() !== "") {
        e.preventDefault();
        add(text);
      }
    } else if (e.key === "Backspace" && text === "" && value.length > 0) {
      removeAt(value.length - 1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      // A closed list opens on its first suggestion; an open one moves down it.
      if (!shown) {
        setOpen(true);
        setActive(0);
      } else setActive(Math.min(active + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(active - 1, 0));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <div
        className={cn(
          "flex min-h-8 w-full flex-wrap items-center gap-1 rounded-lg border border-input bg-transparent px-1.5 py-1 text-sm transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
          disabled && "pointer-events-none opacity-50",
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((t, i) => (
          <span key={t} className="inline-flex min-h-6 max-w-full min-w-0 items-center gap-0.5 rounded-md bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">
            <span className="min-w-0">#{t}</span>
            <button
              type="button"
              tabIndex={-1}
              aria-label={`Remove tag ${t}`}
              className="shrink-0 rounded-sm text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                removeAt(i);
              }}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          ref={inputRef}
          value={text}
          disabled={disabled}
          autoFocus={autoFocus}
          role="combobox"
          aria-describedby={describedBy}
          aria-invalid={invalid}
          aria-expanded={shown}
          aria-controls={shown ? listId : undefined}
          aria-activedescendant={shown ? optionId(active) : undefined}
          aria-autocomplete="list"
          className="h-6 min-w-16 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
          placeholder={value.length === 0 ? placeholder : ""}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Delay so a click on a suggestion registers first.
            setTimeout(() => {
              setOpen(false);
              if (text.trim() !== "") add(text);
            }, 120);
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      {shown && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Tag suggestions"
          className="absolute left-0 z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-md"
        >
          {matches.map((s, i) => (
            <li
              key={s}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              className={cn("cursor-pointer rounded-sm px-2 py-1", i === active && "bg-accent text-accent-foreground")}
              onMouseDown={(e) => {
                e.preventDefault();
                add(s);
              }}
              onMouseEnter={() => setActive(i)}
            >
              #{s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Read-only row of tag chips ("#garden #work"). Renders nothing for no tags. */
export function TagChips({ tags, className, onClick, size = "sm" }: { tags?: readonly string[] | null; className?: string; onClick?: (tag: string) => void; size?: "xs" | "sm" }) {
  if (!tags || tags.length === 0) return null;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {tags.map((t) =>
        onClick ? (
          <button
            key={t}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClick(t);
            }}
            className={cn("rounded-md bg-secondary px-1.5 text-secondary-foreground hover:bg-secondary/70", size === "xs" ? "text-[10px] leading-4" : "text-xs leading-5")}
          >
            #{t}
          </button>
        ) : (
          <span key={t} className={cn("rounded-md bg-secondary px-1.5 text-secondary-foreground", size === "xs" ? "text-[10px] leading-4" : "text-xs leading-5")}>
            #{t}
          </span>
        ),
      )}
    </span>
  );
}
