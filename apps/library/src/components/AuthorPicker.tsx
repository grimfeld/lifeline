import { useEffect, useMemo, useRef, useState } from "react";
import { cn, Input } from "@lifeline/ui";
import { Search, UserPlus, X } from "lucide-react";
import { answersTo, normalizeAuthorName, type AuthorHit } from "../domain/authors";
import type { Author } from "../domain/types";
import { ensureAuthor, useAuthors } from "../data/repo";
import { searchOpenLibraryAuthors } from "../data/openlibrary";

type Suggestion = { kind: "mine"; author: Author } | { kind: "ol"; hit: AuthorHit } | { kind: "new"; name: string };

/**
 * The Author box (ADR 0052): chips for the chosen Authors, and an input that
 * offers your own Authors first (instant), then Open Library's (debounced),
 * then "use the typed name". Picking finds-or-creates the Author and links
 * it; the typed text is also reported so a search can narrow on it unpicked.
 */
export function AuthorPicker({
  value,
  onChange,
  text,
  onTextChange,
  id,
  placeholder = "Author…",
  autoFocus,
  online = true,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  text?: string;
  onTextChange?: (t: string) => void;
  id?: string;
  placeholder?: string;
  autoFocus?: boolean;
  /** Offer Open Library authors too (off inside plain edit forms that only need your own). */
  online?: boolean;
}) {
  const authors = useAuthors();
  const byId = useMemo(() => new Map(authors.map((a) => [a.id, a])), [authors]);
  const [own, setOwn] = useState("");
  const q = text ?? own;
  const setQ = (t: string) => {
    setOwn(t);
    onTextChange?.(t);
  };
  const [olHits, setOlHits] = useState<AuthorHit[]>([]);
  const [highlight, setHighlight] = useState(-1);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const mine = useMemo(() => {
    const key = normalizeAuthorName(q);
    if (!key) return [];
    return authors.filter((a) => !value.includes(a.id) && (normalizeAuthorName(a.title).includes(key) || a.aliases.some((al) => normalizeAuthorName(al).includes(key)))).slice(0, 6);
  }, [authors, q, value]);

  useEffect(() => {
    if (!online || q.trim().length < 3) {
      setOlHits([]);
      return;
    }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      searchOpenLibraryAuthors(q.trim(), ctl.signal)
        .then((hits) => setOlHits(hits.filter((h) => !authors.some((a) => a.externalKey === h.externalKey && value.includes(a.id))).slice(0, 6)))
        .catch(() => {});
    }, 350);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
    // `authors`/`value` only filter; the query drives the fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, online]);

  const typed = q.trim();
  const suggestions: Suggestion[] = [
    ...mine.map((author) => ({ kind: "mine" as const, author })),
    ...olHits.filter((h) => !mine.some((a) => a.externalKey === h.externalKey)).map((hit) => ({ kind: "ol" as const, hit })),
    ...(typed && !mine.some((a) => answersTo(a, typed)) ? [{ kind: "new" as const, name: typed }] : []),
  ];
  const show = open && typed.length > 0 && suggestions.length > 0;

  async function pick(s: Suggestion) {
    let id = "";
    if (s.kind === "mine") id = s.author.id;
    else if (s.kind === "ol") id = await ensureAuthor({ name: s.hit.name, externalKey: s.hit.externalKey, aliases: s.hit.alternateNames });
    else id = await ensureAuthor({ name: s.name });
    if (id && !value.includes(id)) onChange([...value, id]);
    setQ("");
    setOlHits([]);
    setHighlight(-1);
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !q && value.length) {
      onChange(value.slice(0, -1));
      return;
    }
    if (!show) {
      if (e.key === "Enter" && typed) {
        e.preventDefault();
        void pick({ kind: "new", name: typed });
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h <= 0 ? suggestions.length - 1 : h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      void pick(suggestions[highlight >= 0 ? highlight : 0]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className="grid gap-1">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((vid) => (
            <span key={vid} className="bg-muted inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs">
              {byId.get(vid)?.title ?? "…"}
              <button type="button" className="text-muted-foreground hover:text-foreground" aria-label={`Remove ${byId.get(vid)?.title ?? "author"}`} onClick={() => onChange(value.filter((x) => x !== vid))}>
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
        <Input
          ref={inputRef}
          id={id}
          className="pl-8"
          value={q}
          autoFocus={autoFocus}
          placeholder={placeholder}
          autoComplete="off"
          aria-expanded={show}
          aria-autocomplete="list"
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setHighlight(-1);
          }}
          onKeyDown={onKeyDown}
        />
        {show && (
          <ul role="listbox" className="bg-popover text-popover-foreground absolute top-full right-0 left-0 z-20 mt-1 grid max-h-64 gap-0.5 overflow-y-auto rounded-md border p-1 shadow-md">
            {suggestions.map((s, i) => {
              const key = s.kind === "mine" ? s.author.id : s.kind === "ol" ? s.hit.externalKey : "new";
              return (
                <li key={key} role="option" aria-selected={i === highlight}>
                  <button
                    type="button"
                    className={cn("hover:bg-accent flex w-full items-center gap-2 rounded-sm px-1.5 py-1 text-left", i === highlight && "bg-accent")}
                    onMouseEnter={() => setHighlight(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void pick(s)}
                  >
                    {s.kind === "new" && <UserPlus className="text-muted-foreground size-3.5 shrink-0" />}
                    <span className="min-w-0 flex-1">
                      {s.kind === "mine" && (
                        <>
                          <span className="block truncate text-sm">{s.author.title}</span>
                          <span className="text-muted-foreground block truncate text-xs">{[s.author.externalKey ? "" : "unresolved", [s.author.born, s.author.died].filter(Boolean).join(" – ")].filter(Boolean).join(" · ") || "your author"}</span>
                        </>
                      )}
                      {s.kind === "ol" && (
                        <>
                          <span className="block truncate text-sm">{s.hit.name}</span>
                          <span className="text-muted-foreground block truncate text-xs">
                            {[[s.hit.born, s.hit.died].filter(Boolean).join(" – "), s.hit.topWork, s.hit.workCount ? `${s.hit.workCount} works` : ""].filter(Boolean).join(" · ") || "Open Library"}
                          </span>
                        </>
                      )}
                      {s.kind === "new" && <span className="block truncate text-sm">Use “{s.name}”</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
