import { useCallback, useMemo } from "react";
import { Link, useParams } from "react-router";
import { PERSON_TYPE, documentType, patchDocument, todayStr, useDocument, useLinkIndex, useOpenPeek, type Document } from "@lifeline/core";
import { BacklinksSection, DocumentEditor, FieldLinksSection } from "@lifeline/editor";
import { CommitField, Page, PageHeader } from "@lifeline/ui";
import { ArrowLeft } from "lucide-react";
import { PEOPLE_HREF } from "../constants";
import { type Person } from "../domain/types";
import { ageOf } from "../domain/occasions";
import { normalizePerson, patchPerson } from "../data/repo";
import { PersonFields } from "../components/PersonFields";
import { orderedSections, PERSON_SECTIONS } from "./sections";
import { Section } from "../components/Section";

const back = (
  <Link to={PEOPLE_HREF} className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline">
    <ArrowLeft className="size-4" /> People
  </Link>
);

/**
 * The Person page (#404 story 69): a hidden route, as a Library work's page
 * is (ADR 0110), and the Peek's "Open". The header — name, aliases,
 * Relationship — then the sections later tickets fill (`sections.tsx`), the
 * body, and the backlinks, each peeked where the user is.
 */
export function PersonScreen() {
  const { id } = useParams<{ id: string }>();
  const row = useDocument<Person>(id);
  const person = useMemo(() => (row && !row.deleted && row.type === PERSON_TYPE ? normalizePerson(row) : undefined), [row]);
  const index = useLinkIndex();
  const openPeek = useOpenPeek();
  // Only the body and its Tags are written from the editor, so a Field changed above is never sent back as it was.
  const saveBody = useCallback((next: Document) => patchDocument(next.id, { body: next.body, tags: next.tags }), []);

  if (!person) {
    return (
      <Page>
        {back}
        <p className="text-muted-foreground text-sm">No such person here: they may have been deleted, or live in another Workspace.</p>
      </Page>
    );
  }

  const age = ageOf(person.occasions ?? [], todayStr());
  const known = [age === null ? "" : `${age} years old`, person.relationship, person.aliases.length ? `also ${person.aliases.join(", ")}` : ""].filter(Boolean).join(" · ");
  return (
    <Page>
      <div className="min-w-0">{back}</div>
      <header className="grid min-w-0 gap-1">
        <PageHeader title={person.title} />
        {known && <p className="text-muted-foreground min-w-0 text-sm">{known}</p>}
      </header>

      <Section title="Details">
        <CommitField label="Name" value={person.title} onCommit={(title) => patchPerson(person.id, { title })} />
        <PersonFields person={person} />
      </Section>

      {orderedSections(PERSON_SECTIONS).map(({ slot, component: S }) => (
        <S key={slot} person={person} />
      ))}

      <Section title="About them">
        <div className="min-h-40 min-w-0 rounded-lg border p-2">
          <DocumentEditor key={person.id} doc={person} def={documentType(PERSON_TYPE)} index={index} bodyOnly save={saveBody} />
        </div>
      </Section>

      <BacklinksSection docId={person.id} index={index} wikilinksOnly onOpen={(ref) => ref.kind === "doc" && openPeek(ref.id)} />
      {/* What links in through People fields (an Event's With, a Task's For…), grouped by what they are. */}
      <FieldLinksSection docId={person.id} index={index} onOpen={(ref) => ref.kind === "doc" && openPeek(ref.id)} />
    </Page>
  );
}
