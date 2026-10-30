import type { ReactNode } from "react";
import { useBacklinkRows, useOpenPeek } from "@lifeline/core";
import { CommitField, Page, PageHeader } from "@lifeline/ui";
import { ReviewEditor } from "./Marks";
import { PEEK_WRITE_DELAY } from "./WorkPeekFields";

/** A section of the Work page: a sentence-case heading over its content, named for assistive tech by the heading. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid min-w-0 gap-2" aria-label={title}>
      <h2 className="text-muted-foreground text-sm font-medium">{title}</h2>
      {children}
    </section>
  );
}

/** The Documents that link to the work (Quotes, Notes…): each one peeked where the user is. */
function Backlinks({ workId }: { workId: string }) {
  const rows = useBacklinkRows(workId);
  const open = useOpenPeek();
  if (rows.length === 0) return null;
  return (
    <Section title={`Mentioned in · ${rows.length}`}>
      <ul className="grid gap-1">
        {rows.map((r) => (
          <li key={`${r.sourceId}/${r.field ?? ""}`} className="min-w-0">
            <button
              type="button"
              className="focus-visible:ring-ring hover:bg-accent w-full min-w-0 rounded-md px-2 py-1 text-left text-sm focus-visible:ring-2 focus-visible:outline-none"
              onClick={() => open(r.sourceId)}
            >
              {r.title}
            </button>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/**
 * A family work's own page (the Work page, CONTEXT.md): its cover and byline,
 * where it stands and the App's transitions, every plain Field edited in place
 * (as its Peek edits them, ADR 0085), its Parts, the Review, its history and
 * the Documents that mention it. The frame is shared; the App hands in its own
 * pieces — its Fields (`WorkPeekFields` and its extras), its actions, its
 * Parts and anything of its own (the Library's series) as `children`.
 */
export function WorkPage({
  work,
  onPatch,
  back,
  cover,
  byline,
  status,
  actions,
  fields,
  parts,
  dates,
  children,
}: {
  work: { id: string; title: string; body?: string };
  /** The App's write, for the title and the Review; a refusal (throw) shows under the field. */
  onPatch: (patch: { title?: string; body?: string }) => unknown;
  /** The way back to the App. */
  back: ReactNode;
  cover: ReactNode;
  byline?: ReactNode;
  /** Where it stands: its Shelf, Acquisition, slot. */
  status?: ReactNode;
  /** The App's own transitions — the only way a guarded Field moves. */
  actions?: ReactNode;
  /** Its plain Fields, edited in place. */
  fields: ReactNode;
  /** Its Parts and Groups (`PartsSection`), for an App that keeps them. */
  parts?: ReactNode;
  /** Its history, read-only: the days the App stamped ("" = not yet, left out). */
  dates: { label: string; value: string }[];
  /** The App's own sections, after the Parts. */
  children?: ReactNode;
}) {
  const history = dates.filter((d) => d.value);
  return (
    <Page>
      <div className="min-w-0">{back}</div>
      <header className="grid min-w-0 gap-4 md:grid-cols-[10rem_minmax(0,1fr)]">
        {/* A cover's width: a phone shows it smaller, above the title. */}
        <div className="w-32 self-start md:w-full">{cover}</div>
        <div className="grid min-w-0 content-start gap-2">
          <PageHeader title={work.title} />
          {byline && <div className="text-muted-foreground min-w-0 text-sm">{byline}</div>}
          {status && <div className="text-muted-foreground min-w-0 text-sm">{status}</div>}
          {actions && <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      </header>

      <Section title="Details">
        <CommitField
          label="Title"
          delay={PEEK_WRITE_DELAY}
          value={work.title}
          onCommit={(title) => {
            if (!title.trim()) throw new Error("A work needs a title.");
            return onPatch({ title: title.trim() });
          }}
        />
        {fields}
      </Section>

      {parts}
      {children}

      <ReviewEditor body={work.body ?? ""} onSave={async (body) => void (await onPatch({ body }))} />

      {history.length > 0 && (
        <Section title="History">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-3">
            {history.map((d) => (
              <div key={d.label} className="grid min-w-0 gap-0.5">
                <dt className="text-muted-foreground text-xs">{d.label}</dt>
                <dd className="text-sm tabular-nums">{d.value}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      <Backlinks workId={work.id} />
    </Page>
  );
}
