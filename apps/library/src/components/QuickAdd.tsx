import { useEffect, useRef, useState } from "react";
import { cn, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, toast } from "@lifeline/ui";
import { WORK_TYPES, workType, type WorkTypeId } from "../domain/workTypes";
import { deleteWork, parseQuickTitle, quickAddWork, useLookupSettings } from "../data/repo";
import { lookupFor, resolveHit } from "../data/lookup";
import { hitByline, type WorkHit } from "../data/openlibrary";
import { Cover } from "./Cover";

const LAST_TYPE_KEY = "media:quick-type";
const isType = (v: unknown): v is WorkTypeId => WORK_TYPES.some((t) => t.id === v);

function readLastType(): WorkTypeId | null {
  try {
    const v = localStorage.getItem(LAST_TYPE_KEY);
    return isType(v) ? v : null;
  } catch {
    return null;
  }
}

function writeLastType(t: WorkTypeId) {
  try {
    localStorage.setItem(LAST_TYPE_KEY, t);
  } catch {
    /* private mode etc. — remembering the medium is a nicety */
  }
}

/**
 * One-line add (ADR 0006 amendment): "Title — Creator", pick a medium, Enter.
 * The item lands on the To… shelf; the toast offers Undo. When the medium has
 * a lookup (Open Library, MusicBrainz) suggestions appear under the input
 * after a debounce; the lookup never blocks — Enter always adds the raw text
 * unless a suggestion is highlighted.
 */
export function QuickAdd({ defaultType, onAdded, autoFocus, compact }: { defaultType?: WorkTypeId; onAdded?: (id: string) => void; autoFocus?: boolean; compact?: boolean }) {
  const [type, setTypeState] = useState<WorkTypeId>(() => defaultType ?? readLastType() ?? "book");
  const [text, setText] = useState("");
  const [hits, setHits] = useState<WorkHit[]>([]);
  const [highlight, setHighlight] = useState(-1);
  const [hidden, setHidden] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // An add awaits the lookup and the store; Enter or a click meanwhile must not add a twin.
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const settings = useLookupSettings();
  const def = workType(type);

  useEffect(() => {
    if (defaultType) setTypeState(defaultType);
  }, [defaultType]);

  function setType(t: WorkTypeId) {
    setTypeState(t);
    writeLastType(t);
    setHits([]);
    setHighlight(-1);
  }

  // Debounced, abortable, best-effort lookup. Failures are silent: the raw text still adds.
  useEffect(() => {
    const search = lookupFor(type, settings);
    const q = text.trim();
    if (!search || q.length < 3) {
      setHits([]);
      setHighlight(-1);
      return;
    }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      search({ text: q }, ctl.signal)
        .then((res) => {
          setHits(res.slice(0, 5));
          setHighlight(-1);
          setHidden(false);
        })
        .catch(() => {});
    }, 400);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [text, type, settings]);

  async function add(input: { title: string; author?: string; hit?: WorkHit }) {
    const title = input.title.trim();
    if (!title || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      // Lazy enrichment happens only on pick; a hit's Authors are found or created (ADR 0052).
      const hit = input.hit ? await resolveHit(input.hit) : undefined;
      const id = await quickAddWork({ medium: type, title, author: input.author, hit });
      writeLastType(type);
      toast.success(`Added to ${def.wantLabel}`, {
        description: title,
        action: {
          label: "Undo",
          onClick: () => void deleteWork(id),
        },
      });
      setText("");
      setHits([]);
      setHighlight(-1);
      onAdded?.(id);
      inputRef.current?.focus();
    } catch (e) {
      toast.error((e as Error).message || "Could not add it");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const showHits = hits.length > 0 && !hidden && text.trim().length >= 3;

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      if (showHits) {
        e.preventDefault();
        setHidden(true);
        setHighlight(-1);
      }
      return;
    }
    if (showHits && e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % hits.length);
      return;
    }
    if (showHits && e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h <= 0 ? hits.length - 1 : h - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (showHits && highlight >= 0 && hits[highlight]) {
        const h = hits[highlight];
        void add({ title: h.title, hit: h });
      } else {
        const parsed = parseQuickTitle(text);
        void add(parsed);
      }
    }
  }

  const placeholder = `Add ${/^[aeiou]/i.test(def.label) ? "an" : "a"} ${def.label.toLowerCase()} — author…`;

  const mediumPicker = compact ? (
    <Select value={type} onValueChange={(v) => setType(v as WorkTypeId)}>
      <SelectTrigger className="h-8 w-28 shrink-0 text-xs" aria-label="Medium">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {WORK_TYPES.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            {t.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ) : (
    <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Medium">
      {WORK_TYPES.map((t) => (
        <button
          key={t.id}
          type="button"
          role="radio"
          aria-checked={type === t.id}
          className={cn("rounded-full border px-2 py-0.5 text-[11px] transition-colors", type === t.id ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent")}
          onClick={() => setType(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className={cn("grid gap-1.5", compact ? "" : "gap-2")}>
      <div className={cn("flex items-center gap-2", compact ? "" : "flex-col items-stretch sm:flex-row")}>
        <div className="relative min-w-0 flex-1">
          <Input
            ref={inputRef}
            value={text}
            autoFocus={autoFocus}
            readOnly={busy}
            aria-busy={busy}
            placeholder={placeholder}
            aria-label={`Quick add ${def.label.toLowerCase()}`}
            aria-expanded={showHits}
            aria-autocomplete="list"
            onChange={(e) => {
              setText(e.target.value);
              setHidden(false);
            }}
            onKeyDown={onKeyDown}
            className={compact ? "h-8 text-sm" : ""}
          />
          {showHits && (
            <ul role="listbox" className="bg-popover text-popover-foreground absolute top-full right-0 left-0 z-20 mt-1 grid max-h-64 gap-0.5 overflow-y-auto rounded-md border p-1 shadow-md">
              {hits.map((h, i) => (
                <li key={h.externalKey} role="option" aria-selected={i === highlight}>
                  <button
                    type="button"
                    className={cn("hover:bg-accent flex w-full items-center gap-2 rounded-sm px-1.5 py-1 text-left", i === highlight && "bg-accent")}
                    onMouseEnter={() => setHighlight(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void add({ title: h.title, hit: h })}
                  >
                    <Cover item={{ title: h.title, coverUrl: h.coverUrl, type }} className="h-8 w-6 shrink-0" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{h.title}</span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {[hitByline(h), h.year || ""].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {compact && mediumPicker}
      </div>
      {!compact && mediumPicker}
    </div>
  );
}
