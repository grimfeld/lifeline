import { appById } from "@lifeline/core";
import type { LinkRef, NoteIndex } from "../domain/index";
import type { Note } from "../domain/types";
import { excerpt } from "../domain/markdown";

/** Backlinks ("linked mentions"), outgoing links and unresolved links of a note. */
export function LinksPanel({ note, index, onOpen }: { note: Note; index: NoteIndex; onOpen: (ref: LinkRef, name: string) => void }) {
  const backlinks = index.backlinksTo({ kind: "note", noteId: note.id });
  const outgoing = index.linksFrom(note.id);
  const seen = new Set<string>();
  const uniqueOut = outgoing.filter((l) => {
    const k = l.link.name.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return (
    <div className="grid content-start gap-4 text-sm">
      <section>
        <h3 className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">Linked mentions · {backlinks.length}</h3>
        {backlinks.length === 0 ? (
          <p className="text-muted-foreground text-xs">No other note links here yet.</p>
        ) : (
          <ul className="grid gap-1.5">
            {backlinks.map((b, i) => {
              const src = index.byId.get(b.noteId);
              return (
                <li key={`${b.noteId}-${i}`}>
                  <button className="hover:bg-accent w-full rounded-md px-2 py-1 text-left" onClick={() => onOpen({ kind: "note", noteId: b.noteId }, src?.title ?? "")}>
                    <div className="truncate font-medium">{src?.title ?? "?"}</div>
                    <div className="text-muted-foreground line-clamp-2 text-xs">{b.context || excerpt(src?.body ?? "", 100)}</div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {uniqueOut.length > 0 && (
        <section>
          <h3 className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">Links · {uniqueOut.length}</h3>
          <ul className="flex flex-wrap gap-1">
            {uniqueOut.map(({ link, ref }) => (
              <li key={link.from}>
                <button
                  className={`rounded-md border px-1.5 py-0.5 text-xs ${ref.kind === "unresolved" ? "text-muted-foreground border-dashed" : "hover:bg-accent"}`}
                  style={ref.kind === "app" ? { borderColor: ref.color } : undefined}
                  title={ref.kind === "app" ? appById(ref.appId)?.title : ref.kind === "unresolved" ? "Create note" : undefined}
                  onClick={() => onOpen(ref, link.name)}
                >
                  {link.name}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
