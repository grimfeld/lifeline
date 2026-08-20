import { displayTitle, documentType, excerpt, singularOf, type LinkIndex, type LinkRef } from "@lifeline/core";

/** Backlinks ("linked mentions"), outgoing links and unresolved links of a Document. */
export function LinksPanel({ docId, index, onOpen }: { docId: string; index: LinkIndex; onOpen: (ref: LinkRef, name: string) => void }) {
  const backlinks = index.backlinksTo(docId);
  const outgoing = index.linksFrom(docId);
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
          <p className="text-muted-foreground text-xs">Nothing links here yet.</p>
        ) : (
          <ul className="grid gap-1.5">
            {backlinks.map((b, i) => {
              const src = index.byId.get(b.sourceId);
              const def = src ? documentType(src.type) : undefined;
              const title = src ? displayTitle(src, def) : "?";
              return (
                <li key={`${b.sourceId}-${i}`}>
                  <button className="hover:bg-accent w-full rounded-md px-2 py-1 text-left" onClick={() => onOpen({ kind: "doc", id: b.sourceId, type: src?.type ?? "" }, title)}>
                    <div className="flex items-baseline gap-2">
                      <span className="truncate font-medium">{title}</span>
                      {def && <span className="text-muted-foreground shrink-0 text-[10px] uppercase">{singularOf(def)}</span>}
                    </div>
                    <div className="text-muted-foreground line-clamp-2 text-xs">{b.field ? `via ${b.field}` : b.context || excerpt(typeof src?.body === "string" ? src.body : "", 100)}</div>
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
                  title={ref.kind === "unresolved" ? "Create note" : (() => { const d = documentType(ref.type); return d ? singularOf(d) : undefined; })()}
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
