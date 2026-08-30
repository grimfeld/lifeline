import { displayTitle, documentType, excerpt, linkMentions, patchDocument, singularOf, useUnlinkedIn, useUnlinkedMentionsOf, type LinkIndex, type LinkRef, type MentionHit } from "@lifeline/core";
import { Button, toast } from "@lifeline/ui";

/**
 * The links side of a Document: backlinks ("linked mentions"), Unlinked
 * mentions from both ends (CONTEXT.md — who names this Document in plain
 * prose, and which names this body could link), outgoing and unresolved
 * links. Linking a mention is a body rewrite done only on request.
 */
export function LinksPanel({ docId, index, onOpen }: { docId: string; index: LinkIndex; onOpen: (ref: LinkRef, name: string) => void }) {
  const backlinks = index.backlinksTo(docId);
  const outgoing = index.linksFrom(docId);
  const unlinkedOf = useUnlinkedMentionsOf(index, docId);
  const unlinkedHere = useUnlinkedIn(index, docId);
  const seen = new Set<string>();
  const uniqueOut = outgoing.filter((l) => {
    const k = l.link.name.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const bodyOf = (id: string) => {
    const b = index.byId.get(id)?.body;
    return typeof b === "string" ? b : "";
  };
  const titleOf = (id: string) => {
    const d = index.byId.get(id);
    return d ? displayTitle(d, documentType(d.type)) : "?";
  };

  /** Link one mention of this Document inside another Document's body. */
  async function linkThere(sourceId: string, hit: MentionHit) {
    await patchDocument(sourceId, { body: linkMentions(bodyOf(sourceId), [hit]) });
    toast.success(`Linked in “${titleOf(sourceId)}”`);
  }
  /** Link mentions found in this Document's own body. */
  async function linkHere(hits: MentionHit[]) {
    await patchDocument(docId, { body: linkMentions(bodyOf(docId), hits) });
    toast.success(hits.length === 1 ? `Linked ${hits[0].canonical}` : `Linked ${hits.length} mentions`);
  }

  return (
    <div className="grid min-w-0 content-start gap-4 text-sm">
      <section className="min-w-0">
        <h3 className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">Linked mentions · {backlinks.length}</h3>
        {backlinks.length === 0 ? (
          <p className="text-muted-foreground text-xs">Nothing links here yet.</p>
        ) : (
          <ul className="grid min-w-0 gap-1.5">
            {backlinks.map((b, i) => {
              const src = index.byId.get(b.sourceId);
              const def = src ? documentType(src.type) : undefined;
              const title = src ? displayTitle(src, def) : "?";
              return (
                <li key={`${b.sourceId}-${i}`} className="min-w-0">
                  <button className="hover:bg-accent w-full min-w-0 rounded-md px-2 py-1 text-left" onClick={() => onOpen({ kind: "doc", id: b.sourceId, type: src?.type ?? "" }, title)}>
                    <div className="flex min-w-0 items-baseline gap-2">
                      <span className="min-w-0 truncate font-medium">{title}</span>
                      {def && <span className="text-muted-foreground shrink-0 text-[10px] uppercase">{singularOf(def)}</span>}
                    </div>
                    <div className="text-muted-foreground line-clamp-2 text-xs break-words">{b.field ? `via ${b.field}` : b.context || excerpt(typeof src?.body === "string" ? src.body : "", 100)}</div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {unlinkedOf.length > 0 && (
        <section className="min-w-0">
          <h3 className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">Unlinked mentions · {unlinkedOf.length}</h3>
          <ul className="grid min-w-0 gap-1.5">
            {unlinkedOf.map((m, i) => {
              const src = index.byId.get(m.sourceId);
              const def = src ? documentType(src.type) : undefined;
              const title = src ? displayTitle(src, def) : "?";
              return (
                <li key={`${m.sourceId}-${m.hit.from}-${i}`} className="flex min-w-0 items-start gap-1">
                  <button className="hover:bg-accent min-w-0 flex-1 rounded-md px-2 py-1 text-left" onClick={() => onOpen({ kind: "doc", id: m.sourceId, type: src?.type ?? "" }, title)}>
                    <div className="flex min-w-0 items-baseline gap-2">
                      <span className="min-w-0 truncate font-medium">{title}</span>
                      {def && <span className="text-muted-foreground shrink-0 text-[10px] uppercase">{singularOf(def)}</span>}
                    </div>
                    <div className="text-muted-foreground line-clamp-2 text-xs break-words">{m.context}</div>
                  </button>
                  <Button size="sm" variant="outline" className="mt-1 h-6 shrink-0 px-2 text-xs" onClick={() => void linkThere(m.sourceId, m.hit)}>
                    Link
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {unlinkedHere.length > 0 && (
        <section className="min-w-0">
          <h3 className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">Unlinked here · {unlinkedHere.length}</h3>
          <ul className="grid min-w-0 gap-1">
            {unlinkedHere.map((h, i) => {
              const def = documentType(index.byId.get(h.targetId)?.type ?? "");
              return (
                <li key={`${h.from}-${i}`} className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-xs" title={h.canonical}>
                    {h.text}
                    {h.text !== h.canonical && <span className="text-muted-foreground"> → {h.canonical}</span>}
                    {def && <span className="text-muted-foreground ml-1 text-[10px] uppercase">{singularOf(def)}</span>}
                  </span>
                  <Button size="sm" variant="outline" className="h-6 shrink-0 px-2 text-xs" onClick={() => void linkHere([h])}>
                    Link
                  </Button>
                </li>
              );
            })}
          </ul>
          {unlinkedHere.length > 1 && (
            <Button size="sm" variant="outline" className="mt-1.5 h-6 w-full text-xs" onClick={() => void linkHere(unlinkedHere)}>
              Link all
            </Button>
          )}
        </section>
      )}
      {uniqueOut.length > 0 && (
        <section className="min-w-0">
          <h3 className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">Links · {uniqueOut.length}</h3>
          <ul className="flex min-w-0 flex-wrap gap-1">
            {uniqueOut.map(({ link, ref }) => (
              <li key={link.from} className="max-w-full min-w-0">
                <button
                  className={`block max-w-full truncate rounded-md border px-1.5 py-0.5 text-xs ${ref.kind === "unresolved" ? "text-muted-foreground border-dashed" : ref.kind === "locked" ? "text-muted-foreground" : "hover:bg-accent"}`}
                  title={ref.kind === "unresolved" ? "Create note" : ref.kind === "locked" ? "In Private — unlock to open" : (() => { const d = documentType(ref.type); return d ? singularOf(d) : undefined; })()}
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
