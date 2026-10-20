import { useMemo, useState } from "react";
import { displayTitle, documentType, excerpt, getDocument, linkMentions, patchDocument, planLinkAll, singularOf, unambiguousHits, useUnlinkedIn, useUnlinkedMentionsOf, type LinkIndex, type LinkRef, type MentionHit } from "@lifeline/core";
import { Button, toast } from "@lifeline/ui";

type OnOpen = (ref: LinkRef, name: string) => void;
interface SectionProps {
  docId: string;
  index: LinkIndex;
  onOpen: OnOpen;
}

const HEADING = "text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase";

function bodyIn(index: LinkIndex, id: string): string {
  const b = index.byId.get(id)?.body;
  return typeof b === "string" ? b : "";
}
function titleIn(index: LinkIndex, id: string): string {
  const d = index.byId.get(id);
  return d ? displayTitle(d, documentType(d.type)) : "?";
}

/** A source Document as a row: its title, its type and the line that names the target. */
function SourceRow({ index, sourceId, context, onOpen }: { index: LinkIndex; sourceId: string; context: string; onOpen: OnOpen }) {
  const src = index.byId.get(sourceId);
  const def = src ? documentType(src.type) : undefined;
  const title = src ? displayTitle(src, def) : "?";
  return (
    <button className="hover:bg-accent w-full min-w-0 flex-1 rounded-md px-2 py-1 text-left" onClick={() => onOpen({ kind: "doc", id: sourceId, type: src?.type ?? "" }, title)}>
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="min-w-0 truncate font-medium">{title}</span>
        {def && <span className="text-muted-foreground shrink-0 text-[10px] uppercase">{singularOf(def)}</span>}
      </div>
      <div className="text-muted-foreground line-clamp-2 text-xs break-words">{context}</div>
    </button>
  );
}

/** Backlinks: the Documents that link here, by wikilink or Link field. */
export function BacklinksSection({ docId, index, onOpen, emptyHint = true }: SectionProps & { emptyHint?: boolean }) {
  const backlinks = index.backlinksTo(docId);
  if (backlinks.length === 0 && !emptyHint) return null;
  return (
    <section className="min-w-0">
      <h3 className={HEADING}>Backlinks · {backlinks.length}</h3>
      {backlinks.length === 0 ? (
        <p className="text-muted-foreground text-xs">Nothing links here yet.</p>
      ) : (
        <ul className="grid min-w-0 gap-1.5">
          {backlinks.map((b, i) => {
            const src = index.byId.get(b.sourceId);
            return (
              <li key={`${b.sourceId}-${i}`} className="min-w-0">
                <SourceRow index={index} sourceId={b.sourceId} onOpen={onOpen} context={b.field ? `via ${b.field}` : b.context || excerpt(typeof src?.body === "string" ? src.body : "", 100)} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * Unlinked mentions from the target's side: other Documents that name this one
 * in plain prose. "Link all" rewrites every one of those bodies at once, so it
 * asks first, leaves the hits it would have to guess at (`planLinkAll`), and
 * one Undo puts every body back.
 */
export function UnlinkedMentionsSection({ docId, index, onOpen }: SectionProps) {
  const unlinkedOf = useUnlinkedMentionsOf(index, docId);
  const [confirming, setConfirming] = useState(false);
  const plan = useMemo(() => planLinkAll(index, docId, unlinkedOf), [index, docId, unlinkedOf]);
  if (unlinkedOf.length === 0) return null;
  const safe = plan.sources.reduce((n, s) => n + s.hits.length, 0);
  const name = titleIn(index, docId);

  async function linkThere(sourceId: string, hit: MentionHit) {
    await patchDocument(sourceId, { body: linkMentions(bodyIn(index, sourceId), [hit]) });
    toast.success(`Linked in “${titleIn(index, sourceId)}”`);
  }
  async function linkAll() {
    setConfirming(false);
    const written: { id: string; before: string; after: string }[] = [];
    for (const { sourceId, hits } of plan.sources) {
      const before = bodyIn(index, sourceId);
      const after = linkMentions(before, hits);
      await patchDocument(sourceId, { body: after });
      written.push({ id: sourceId, before, after });
    }
    const n = written.length;
    toast.success(`Linked ${name} in ${n} ${n === 1 ? "page" : "pages"}`, {
      action: {
        label: "Undo",
        onClick: () =>
          void (async () => {
            // A body edited since keeps its edit: undo only what is still exactly as we left it.
            for (const w of written) if ((await getDocument(w.id))?.body === w.after) await patchDocument(w.id, { body: w.before });
          })(),
      },
    });
  }

  return (
    <section className="min-w-0">
      <h3 className={HEADING}>Unlinked mentions · {unlinkedOf.length}</h3>
      <ul className="grid min-w-0 gap-1.5">
        {unlinkedOf.map((m, i) => (
          <li key={`${m.sourceId}-${m.hit.from}-${i}`} className="flex min-w-0 items-start gap-1">
            <SourceRow index={index} sourceId={m.sourceId} context={m.context} onOpen={onOpen} />
            <Button size="sm" variant="outline" className="mt-1 h-6 shrink-0 px-2 text-xs" onClick={() => void linkThere(m.sourceId, m.hit)}>
              Link
            </Button>
          </li>
        ))}
      </ul>
      {safe > 1 &&
        (confirming ? (
          <div className="mt-1.5 grid gap-1">
            <p className="text-xs">
              Link {name} in {plan.sources.length} {plan.sources.length === 1 ? "page" : "pages"}?
            </p>
            <div className="flex gap-1">
              <Button size="sm" className="h-6 flex-1 text-xs" onClick={() => void linkAll()}>
                Link
              </Button>
              <Button size="sm" variant="ghost" className="h-6 flex-1 text-xs" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="outline" className="mt-1.5 h-6 w-full text-xs" onClick={() => setConfirming(true)}>
            Link all ({safe})
          </Button>
        ))}
      {plan.skipped.length > 0 && (
        <p className="text-muted-foreground mt-1 text-xs">
          {plan.skipped.length} {plan.skipped.length === 1 ? "mention could" : "mentions could"} mean another page — link {plan.skipped.length === 1 ? "it" : "them"} one by one.
        </p>
      )}
    </section>
  );
}

/**
 * Unlinked names (CONTEXT.md): names of other Documents in this Document's own
 * body, every one even where two overlap ("Pour Alix" and "Alix"). Link all
 * leaves those overlaps to be linked one by one — it would have to choose.
 */
export function UnlinkedNamesSection({ docId, index }: Omit<SectionProps, "onOpen">) {
  const hits = useUnlinkedIn(index, docId);
  const safe = useMemo(() => unambiguousHits(hits), [hits]);
  if (hits.length === 0) return null;
  async function linkHere(list: MentionHit[]) {
    await patchDocument(docId, { body: linkMentions(bodyIn(index, docId), list) });
    toast.success(list.length === 1 ? `Linked ${list[0].canonical}` : `Linked ${list.length} mentions`);
  }
  return (
    <section className="min-w-0">
      <h3 className={HEADING}>Unlinked names · {hits.length}</h3>
      <ul className="grid min-w-0 gap-1">
        {hits.map((h, i) => {
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
      {safe.length > 1 && (
        <Button size="xs" variant="outline" className="mt-1.5 w-full" onClick={() => void linkHere(safe)}>
          {safe.length === hits.length ? "Link all" : `Link ${safe.length} unambiguous`}
        </Button>
      )}
    </section>
  );
}

/** Outgoing links, one chip per name: resolved, unresolved (dashed) or behind the Private lock. */
export function OutgoingLinksSection({ docId, index, onOpen }: SectionProps) {
  const seen = new Set<string>();
  const uniqueOut = index.linksFrom(docId).filter((l) => {
    const k = l.link.name.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (uniqueOut.length === 0) return null;
  return (
    <section className="min-w-0">
      <h3 className={HEADING}>Links · {uniqueOut.length}</h3>
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
  );
}

/**
 * The links side of a Document: Backlinks, Unlinked mentions from both ends
 * (CONTEXT.md — who names this Document in plain prose, and the unlinked names
 * in this body), outgoing and unresolved links. Linking a mention is a body
 * rewrite done only on request. Each section stands alone too, for a Module's
 * own side column (the Journal's).
 */
export function LinksPanel({ docId, index, onOpen }: SectionProps) {
  return (
    <div className="grid min-w-0 content-start gap-4 text-sm">
      <BacklinksSection docId={docId} index={index} onOpen={onOpen} />
      <UnlinkedMentionsSection docId={docId} index={index} onOpen={onOpen} />
      <UnlinkedNamesSection docId={docId} index={index} />
      <OutgoingLinksSection docId={docId} index={index} onOpen={onOpen} />
    </div>
  );
}
