import { useCallback, useId, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { PERSON_TYPE, documentType, patchDocument, todayStr, useDocument, useLinkIndex, type Document } from "@lifeline/core";
import { DocumentEditor } from "@lifeline/editor";
import { Badge, Input, Page, PageHeader, cn, useCommitDraft } from "@lifeline/ui";
import { ArrowLeft, AtSign, Mail, Phone, Plus } from "lucide-react";
import { PEOPLE_HREF } from "../constants";
import { type ContactKind, type Person } from "../domain/types";
import { ageOf, upcomingOccasions } from "../domain/occasions";
import { knownLine } from "../domain/person";
import { quickContacts } from "../domain/contactDetails";
import { livePerson, patchPerson } from "../data/repo";
import { PersonFields } from "../components/PersonFields";
import { Section } from "../components/Section";
import { OccasionsSection } from "../components/OccasionsSection";
import { AddressesSection } from "../components/AddressesSection";
import { BLANK_DETAIL, ContactDetailsSection } from "../components/ContactDetailsSection";
import type { DetailInput } from "../domain/contactDetails";
import { EditToggle, EditingProvider } from "../components/Cards";
import { NextOccasionBadge, TagBadges } from "../components/Badges";
import { TiesSection } from "./TiesSection";
import { ReportsSection } from "./ReportsSection";
import { TimelineSection } from "./TimelineSection";

const back = (
  <Link to={PEOPLE_HREF} className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline">
    <ArrowLeft className="size-4" /> People
  </Link>
);

/**
 * A line of text written where it stands: on Enter or on leaving it; Escape puts it back.
 * A refused write shows under the field and leaves what was typed, to be fixed.
 */
function InlineText({ label, value, placeholder, required, onCommit, className }: { label: string; value: string; placeholder?: string; required?: boolean; onCommit: (v: string) => unknown; className?: string }) {
  const { draft, error, change, commit, revert } = useCommitDraft(
    value,
    (next: string) => {
      const text = next.trim();
      if (required && !text) throw new Error(`${label} can't be empty.`);
      return onCommit(text);
    },
    { equals: (a, b) => a.trim() === b.trim() },
  );
  const errorId = useId();
  return (
    <div className="grid min-w-0 gap-1">
      <Input
        aria-label={label}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        value={draft}
        placeholder={placeholder}
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
        className={cn("hover:border-input border-transparent bg-transparent", className)}
      />
      {error && (
        <p id={errorId} data-slot="field-error" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}

const QUICK: Record<ContactKind, { label: string; icon: typeof Phone }> = {
  phone: { label: "Call", icon: Phone },
  email: { label: "Email", icon: Mail },
  handle: { label: "Profile", icon: AtSign },
};

/**
 * The page's contact buttons (#422): Call, Email and Profile, each the first
 * current detail of its kind. One with nothing behind it is dimmed, and adds
 * a detail of its kind.
 */
function ContactButtons({ person, onAdd }: { person: Person; onAdd: (kind: ContactKind) => void }) {
  return (
    <div className="flex min-w-0 flex-wrap gap-4">
      {quickContacts(person).map(({ kind, detail, action }) => {
        const { label, icon: Icon } = QUICK[kind];
        const disc = (
          <span className={cn("relative flex size-10 items-center justify-center rounded-full", action ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
            <Icon className="size-4" />
            {/* Nothing behind it: a plus says pressing adds a detail rather than calls. */}
            {!action && (
              <span aria-hidden className="bg-background text-foreground absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full border">
                <Plus className="size-3" />
              </span>
            )}
          </span>
        );
        const tile = "focus-visible:ring-ring flex flex-col items-center gap-1 rounded-lg text-xs focus-visible:ring-2 focus-visible:outline-none";
        return action && detail ? (
          <a key={kind} href={action.href} aria-label={`${label} ${detail.value}`} {...(action.external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className={tile}>
            {disc}
            {label}
          </a>
        ) : (
          <button key={kind} type="button" onClick={() => onAdd(kind)} aria-label={`${label}: add a contact detail`} className={cn(tile, "text-muted-foreground")}>
            {disc}
            {label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The Person page (#404 story 69, #422): a hidden route, as a Library work's
 * page is (ADR 0110), and the Peek's "Open". The name and Relationship, the
 * contact buttons, then two columns: the cards (Contact details, Addresses,
 * Occasions, Ties), read by default and changed in Edit; and About them, the
 * Reports and the timeline of what links to them. Stacked on a phone.
 */
export function PersonScreen() {
  const { id } = useParams<{ id: string }>();
  const row = useDocument<Person>(id);
  const person = useMemo(() => livePerson(row), [row]);
  const index = useLinkIndex();
  const [editing, setEditing] = useState(false);
  // Only the body and its Tags are written from the editor, so a Field changed above is never sent back as it was.
  const saveBody = useCallback((next: Document) => patchDocument(next.id, { body: next.body, tags: next.tags }), []);
  const [detailEditing, setDetailEditing] = useState<DetailInput | null>(null);

  if (!person) {
    return (
      <Page>
        {back}
        <p className="text-muted-foreground text-sm">No such person here: they may have been deleted, or live in another Workspace.</p>
      </Page>
    );
  }

  const today = todayStr();
  const known = knownLine(person.aliases, ageOf(person.occasions ?? [], today));
  const next = upcomingOccasions([person], today, 364)[0];
  return (
    <EditingProvider value={editing}>
      <Page width="wide">
        <div className="flex min-w-0 items-center justify-between gap-2">
          {back}
          <EditToggle editing={editing} onChange={setEditing} />
        </div>

        <header className="grid min-w-0 gap-1">
          <PageHeader
            title={editing ? <InlineText label="Name" required value={person.title} onCommit={(title) => patchPerson(person.id, { title })} className="-mx-1" /> : person.title}
            documentTitle={person.title}
          />
          <InlineText
            label="Relationship"
            value={person.relationship}
            placeholder="What they are to you: my aunt, a climbing partner…"
            onCommit={(relationship) => patchPerson(person.id, { relationship })}
            className="-mx-1 text-sm"
          />
          {known && <p className="text-muted-foreground min-w-0 text-sm break-words">{known}</p>}
        </header>

        <div className="flex min-w-0 flex-wrap items-start gap-4">
          <ContactButtons person={person} onAdd={(kind) => setDetailEditing({ ...BLANK_DETAIL, kind })} />
          {next && <NextOccasionBadge next={next} variant="secondary" />}
        </div>

        {/* A grid track of 22rem: the cards' column, wide enough for an Address on two lines. */}
        <div className="grid min-w-0 gap-6 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] md:gap-6">
          <div className="grid min-w-0 content-start gap-6">
            <ContactDetailsSection person={person} editing={detailEditing} onEditing={setDetailEditing} />
            <AddressesSection person={person} />
            <OccasionsSection person={person} />
            <TiesSection person={person} />
            {editing ? (
              <Section title="More">
                <PersonFields person={person} relationship={false} />
              </Section>
            ) : (
              (person.tags.length > 0 || person.excludedFromDrifting) && (
                <div className="flex min-w-0 flex-wrap gap-1">
                  <TagBadges tags={person.tags} variant="secondary" />
                  {person.excludedFromDrifting && <Badge variant="outline">Left out of Drifting</Badge>}
                </div>
              )
            )}
          </div>

          <div className="grid min-w-0 content-start gap-6">
            <Section title="About them">
              <div className="min-h-28 min-w-0 rounded-lg border p-2">
                <DocumentEditor key={person.id} doc={person} def={documentType(PERSON_TYPE)} index={index} bodyOnly bodyLabel="About them" save={saveBody} />
              </div>
            </Section>
            <ReportsSection person={person} />
            <TimelineSection person={person} />
          </div>
        </div>
      </Page>
    </EditingProvider>
  );
}
