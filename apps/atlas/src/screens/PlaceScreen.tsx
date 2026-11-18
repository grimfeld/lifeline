import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { PLACE_TYPE, TitleTaken, appById, documentFigures, documentType, patchDocument, reportsIn, seenSummary, sourceOf, todayStr, useDocument, useLinkIndex, type Document, type LinkIndex } from "@lifeline/core";
import { BacklinksSection, DocumentEditor, DocumentReports, UnlinkedMentionsSection, useOpenLinkRef } from "@lifeline/editor";
import { Field, Input, MiniMap, Page, PageHeader, useCommitDraft } from "@lifeline/ui";
import { ArrowLeft } from "lucide-react";
import { PLACES_HREF, placeHref } from "../constants";
import { livePlace, patchPlace, settleToTry } from "../data/repo";
import { PlaceFields } from "../components/PlaceFields";
import { placeCoordsOf } from "../domain/place";
import { PlaceTimeline } from "./PlaceTimeline";

const back = (
  <Link to={PLACES_HREF} className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline">
    <ArrowLeft className="size-4" /> Places
  </Link>
);

/**
 * A Place's name, renamed where it stands: on Enter or on leaving it. A name
 * another Place has is refused under the field, with a link to that Place.
 */
function NameField({ place }: { place: Document }) {
  const [taken, setTaken] = useState<Document>();
  const { draft, error, change, commit, revert } = useCommitDraft(
    place.title,
    async (next: string) => {
      setTaken(undefined);
      try {
        await patchPlace(place.id, { title: next });
      } catch (e) {
        if (e instanceof TitleTaken) setTaken(e.existing);
        throw e;
      }
    },
    { equals: (a, b) => a.trim() === b.trim() },
  );
  return (
    <div className="grid min-w-0 gap-1">
      <Field label="Name" error={error || undefined}>
        <Input
          value={draft}
          onChange={(e) => change(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              e.stopPropagation();
              revert();
              e.currentTarget.blur();
            }
          }}
        />
      </Field>
      {error && taken && (
        <Link to={placeHref(taken.id)} className="text-primary min-w-0 truncate text-sm hover:underline">
          Open {taken.title}
        </Link>
      )}
    </div>
  );
}

/** "Last visited 10 Nov · 1 visit" (ADR 0128): counted from the Events that link to it, once per day, only those that have happened. */
function Visited({ place, index }: { place: Document; index: LinkIndex }) {
  const today = todayStr();
  const line = useMemo(() => seenSummary(documentFigures(index, place.id, today, sourceOf("seen", today)), documentType(PLACE_TYPE)), [index, place.id, today]);
  return <p className="text-muted-foreground min-w-0 text-sm break-words">{line}</p>;
}

/** The Place's Reports, as its type chooses them: Visited and Mentioned side by side, never added together. */
function ReportsSection({ place, index }: { place: Document; index: LinkIndex }) {
  const def = documentType(PLACE_TYPE);
  if (reportsIn(def, "document").length === 0) return null;
  return (
    <section className="grid min-w-0 gap-2" aria-label="Reports">
      <h2 className="text-muted-foreground text-sm font-medium">Reports</h2>
      <DocumentReports index={index} def={def} docId={place.id} heading={false} />
    </section>
  );
}

/** The Place's spot, read from its stored coordinates (never looked up here, ADR 0011); nothing while it has none. */
function PlaceMap({ place, onExpand }: { place: Document; onExpand: () => void }) {
  const at = placeCoordsOf(place);
  if (!at) return null;
  return (
    <section aria-label="On the map" className="min-w-0">
      <MiniMap lat={at.lat} lon={at.lon} color={appById("atlas")?.color} onExpand={onExpand} />
    </section>
  );
}

/**
 * A Place's page (ADR 0128): a hidden route, and the Peek's "Open". Its name,
 * when it was last visited, Kind, address and its spot on a map, aliases and
 * Tags, and its Reports; what it is, in the body; its timeline; and what links
 * to it, with the prose that names it unlinked. Two columns on the desk,
 * stacked on a phone.
 */
export function PlaceScreen() {
  const { id } = useParams<{ id: string }>();
  const row = useDocument(id);
  const place = useMemo(() => livePlace(row), [row]);
  const index = useLinkIndex();
  const open = useOpenLinkRef(index);
  const navigate = useNavigate();
  // Only the body and its Tags are written from the editor, so a Field changed beside it is never sent back as it was.
  const saveBody = useCallback((next: Document) => patchDocument(next.id, { body: next.body, tags: next.tags }), []);
  // To try is settled on opening too (ADR 0128): a dinner booked here may have passed since anything was saved.
  useEffect(() => {
    if (id) void settleToTry(id);
  }, [id]);

  if (!place) {
    return (
      <Page>
        {back}
        <p className="text-muted-foreground text-sm">No such place here: it may have been deleted, or belong to another Workspace.</p>
      </Page>
    );
  }

  return (
    <Page width="wide">
      {back}
      <div className="grid min-w-0 gap-1">
        <PageHeader title={place.title} />
        <Visited place={place} index={index} />
      </div>
      {place.closed && <p className="text-muted-foreground text-sm">Closed: off the map and the lists of places to go. Untick Closed to reopen it.</p>}
      {/* A grid track of 22rem: the fields' column, as the Person page's. */}
      <div className="grid min-w-0 gap-6 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <section className="grid min-w-0 content-start gap-3" aria-label="Details">
          <NameField key={place.id} place={place} />
          <PlaceFields place={place} />
          <PlaceMap place={place} onExpand={() => navigate(`/map?focus=${PLACE_TYPE}/${place.id}`)} />
          <ReportsSection place={place} index={index} />
        </section>
        <div className="grid min-w-0 content-start gap-6">
          <section className="grid min-w-0 gap-2">
            <h2 className="text-muted-foreground text-sm font-medium">Notes</h2>
            <div className="min-h-28 min-w-0 rounded-lg border p-2">
              <DocumentEditor key={place.id} doc={place} def={documentType(PLACE_TYPE)} index={index} bodyOnly bodyLabel="Notes" save={saveBody} />
            </div>
          </section>
          <PlaceTimeline place={place} index={index} />
          <div className="grid min-w-0 gap-4 text-sm">
            <BacklinksSection docId={place.id} index={index} onOpen={open} />
            <UnlinkedMentionsSection docId={place.id} index={index} onOpen={open} />
          </div>
        </div>
      </div>
    </Page>
  );
}
