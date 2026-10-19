import { useMemo, useState } from "react";
import { Button, Combobox, type ComboboxOption } from "@lifeline/ui";
import { Search, X } from "lucide-react";
import type { Author } from "../domain/types";
import { ensureAuthor, useAuthors } from "../data/repo";
import { searchOpenLibraryAuthors } from "../data/openlibrary";
import type { AuthorHit } from "../domain/authors";

type Suggestion = ComboboxOption & ({ kind: "mine"; author: Author } | { kind: "ol"; hit: AuthorHit });

const lifespan = (born?: string, died?: string) => [born, died].filter(Boolean).join(" – ");

const mineOption = (author: Author): Suggestion => ({
  kind: "mine",
  author,
  value: author.id,
  label: author.title,
  keywords: author.aliases,
  description: [author.externalKey ? "" : "unresolved", lifespan(author.born, author.died)].filter(Boolean).join(" · ") || "your author",
});

const olOption = (hit: AuthorHit): Suggestion => ({
  kind: "ol",
  hit,
  value: hit.externalKey,
  label: hit.name,
  description: [lifespan(hit.born, hit.died), hit.topWork, hit.workCount ? `${hit.workCount} works` : ""].filter(Boolean).join(" · ") || "Open Library",
});

/**
 * The Author box (ADR 0052): chips for the chosen Authors, and a Combobox
 * that offers your own Authors first (instant), then Open Library's
 * (debounced), then "use the typed name". Picking finds-or-creates the
 * Author and links it; the typed text is also reported so a search can
 * narrow on it unpicked.
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

  const options = useMemo(() => authors.filter((a) => !value.includes(a.id)).map(mineOption), [authors, value]);

  // An Open Library hit for an Author you already have is that Author (listed once, already linked ones not at all).
  async function search(query: string, signal: AbortSignal): Promise<Suggestion[]> {
    const hits = await searchOpenLibraryAuthors(query, signal);
    return hits
      .map((h) => {
        const mine = authors.find((a) => a.externalKey === h.externalKey);
        return mine ? (value.includes(mine.id) ? null : mineOption(mine)) : olOption(h);
      })
      .filter((s): s is Suggestion => s !== null);
  }

  function link(found: string) {
    if (found && !value.includes(found)) onChange([...value, found]);
  }

  async function pick(s: Suggestion) {
    if (s.kind === "mine") return link(s.author.id);
    return link(await ensureAuthor({ name: s.hit.name, externalKey: s.hit.externalKey, aliases: s.hit.alternateNames }));
  }

  return (
    <div className="grid gap-1">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((vid) => (
            <span key={vid} className="bg-muted inline-flex max-w-full min-w-0 items-center gap-0.5 rounded-md pl-1.5 text-xs">
              <span className="min-w-0 truncate">{byId.get(vid)?.title ?? "…"}</span>
              <Button
                size="icon-xs"
                variant="ghost"
                className="text-muted-foreground"
                aria-label={`Remove ${byId.get(vid)?.title ?? "author"}`}
                onClick={() => onChange(value.filter((x) => x !== vid))}
              >
                <X />
              </Button>
            </span>
          ))}
        </div>
      )}
      <Combobox<Suggestion>
        id={id}
        query={q}
        onQueryChange={setQ}
        options={options}
        search={online ? search : undefined}
        onValueChange={(_, s) => void pick(s)}
        onCreate={(name) => void ensureAuthor({ name }).then(link)}
        createLabel={(name) => <>Use “{name}”</>}
        limit={6}
        listLabel="Authors"
        leading={<Search />}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onKeyDown={(e) => {
          if (e.key === "Backspace" && !q && value.length) {
            e.preventDefault();
            onChange(value.slice(0, -1));
          }
        }}
      />
    </div>
  );
}
