import { useCallback, useMemo } from "react";
import { Link, useParams } from "react-router";
import { Badge, Button } from "@lifeline/ui";
import { docHref, documentType, isExternalUrl, patchDocument, useDocument, useLinkIndex, type Document } from "@lifeline/core";
import { FieldsForm, MarkdownView } from "@lifeline/editor";
import { ArrowLeft, ArrowUpRight, ExternalLink } from "lucide-react";
import { useSources } from "../data/works";
import { useNotes } from "../data/notes";
import { useQuotes } from "../data/quotes";
import { familyLabel } from "../domain/works";
import { SHELF_HREF, SOURCE, noteHref, sourceHref } from "../domain/types";
import { Cover } from "../components/Cover";
import { CaptureForm } from "../components/CaptureForm";
import { newestFirst, QuoteBlock } from "../components/QuoteBlock";

/**
 * One Source as a hub (ADR 0070): what it is, and everything I took from it —
 * my Notes and its Quotes — with the form to take more right there. A work's
 * own page stays its App's (Library, Cinema); this is the Notes side of it.
 */
export function SourceScreen() {
  const { id } = useParams();
  const doc = useDocument<Document>(id);
  const sources = useSources();
  const notes = useNotes();
  const quotes = useQuotes();
  const index = useLinkIndex();
  const item = sources.find((s) => s.id === id);
  const children = useMemo(() => sources.filter((s) => s.parent === id), [sources, id]);
  // A parent Source gathers what was taken from its children too (CONTEXT.md "Source"), each marked with the child it came from.
  const childTitle = useMemo(() => new Map(children.map((c) => [c.id, c.title])), [children]);
  const from = useCallback((source: string) => source === id || childTitle.has(source), [id, childTitle]);
  const own = useMemo(() => newestFirst(quotes.filter((q) => from(q.source))), [quotes, from]);
  const mine = useMemo(() => notes.filter((n) => from(n.source)).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.updatedAt.localeCompare(a.updatedAt)), [notes, from]);
  const parent = item?.parent ? sources.find((s) => s.id === item.parent) : undefined;

  if (!doc || !item) {
    return <div className="text-muted-foreground p-6 text-sm">This Source isn't here — it may have been deleted, or it lives in another Workspace.</div>;
  }
  const def = documentType(doc.type);
  const isOwn = doc.type === SOURCE;
  const ownFields = isOwn ? (def?.fields ?? []).filter((f) => f.key !== "aliases") : [];

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-5 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost" className="h-7">
          <Link to={SHELF_HREF}>
            <ArrowLeft /> Notes
          </Link>
        </Button>
      </div>
      <header className="flex min-w-0 items-start gap-3">
        <Cover item={item} className="h-20 w-14 text-[8px]" />
        <div className="grid min-w-0 flex-1 gap-1">
          <h1 className="text-xl font-semibold tracking-tight [overflow-wrap:anywhere]">{item.title}</h1>
          <div className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <Badge variant="secondary">{familyLabel(item.family, false, (t) => (documentType(t) ? documentType(t)!.label : undefined))}</Badge>
            {item.creator && <span className="min-w-0 truncate">{item.creator}</span>}
            {parent && (
              <span className="min-w-0 truncate">
                part of{" "}
                <Link to={sourceHref(parent.id)} className="underline-offset-2 hover:underline">
                  {parent.title}
                </Link>
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {/* Only an http(s) address becomes a link: a stored `javascript:` one stays text. */}
            {item.url &&
              (isExternalUrl(item.url) ? (
                <a href={item.url} target="_blank" rel="noreferrer" className="text-muted-foreground inline-flex min-w-0 items-center gap-1 underline-offset-2 hover:underline">
                  <ExternalLink className="size-3 shrink-0" /> <span className="truncate">{item.url}</span>
                </a>
              ) : (
                <span className="text-muted-foreground min-w-0 truncate">{item.url}</span>
              ))}
            {!isOwn && (
              <Link to={docHref(doc)} className="text-muted-foreground inline-flex items-center gap-1 underline-offset-2 hover:underline">
                <ArrowUpRight className="size-3" /> Open its own page
              </Link>
            )}
          </div>
        </div>
      </header>

      {isOwn && ownFields.length > 0 && (
        <details className="rounded-lg border p-3">
          <summary className="text-muted-foreground cursor-pointer text-xs">Details</summary>
          <div className="mt-2">
            <FieldsForm def={{ fields: ownFields }} value={doc} onChange={(next) => void patchDocument(doc.id, next)} />
          </div>
        </details>
      )}

      <section className="bg-card rounded-lg border p-3" aria-label="Take a note or a quote">
        <CaptureForm source={doc.id} />
      </section>

      {children.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Inside it · {children.length}</h2>
          <div className="flex flex-wrap gap-1.5">
            {children.map((c) => (
              <Link key={c.id} to={sourceHref(c.id)} className="hover:bg-accent max-w-full truncate rounded-full border px-2.5 py-0.5 text-xs">
                {c.title}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-2" aria-label="Notes">
        <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Notes · {mine.length}</h2>
        {mine.length === 0 ? (
          <p className="text-muted-foreground text-sm">No notes on it yet.</p>
        ) : (
          mine.map((n) => (
            <Link key={n.id} to={noteHref(n.id)} className="bg-card hover:bg-accent/40 grid min-w-0 gap-1 rounded-lg border p-3 transition-colors">
              <div className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{n.title}</span>
                {childTitle.has(n.source) && <span className="text-muted-foreground max-w-40 shrink-0 truncate text-xs">{childTitle.get(n.source)}</span>}
                {n.locator && <span className="text-muted-foreground shrink-0 text-xs">{n.locator}</span>}
              </div>
              <div className="text-muted-foreground line-clamp-4 min-w-0 text-sm">
                <MarkdownView body={n.body} index={index} compact origin={n.id} />
              </div>
            </Link>
          ))
        )}
      </section>

      <section className="grid gap-2" aria-label="Quotes">
        <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Quotes · {own.length}</h2>
        {own.length === 0 ? (
          <p className="text-muted-foreground text-sm">No quotes from it yet.</p>
        ) : (
          own.map((x) => (
            <div key={x.id} id={`q-${x.id}`}>
              <QuoteBlock quote={x} item={childTitle.has(x.source) ? sources.find((s) => s.id === x.source) : item} showItem={childTitle.has(x.source)} />
            </div>
          ))
        )}
      </section>
    </div>
  );
}
