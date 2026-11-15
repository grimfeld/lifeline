import { useCallback, useMemo } from "react";
import { Link, useParams } from "react-router";
import { documentType, patchDocument, useDocument, useLinkIndex, type Document } from "@lifeline/core";
import { DocumentEditor } from "@lifeline/editor";
import { Page, PageHeader } from "@lifeline/ui";
import { ArrowLeft } from "lucide-react";
import { HOUSEHOLDS_HREF } from "../constants";
import { HOUSEHOLD, type Household } from "../domain/types";
import { liveHousehold, patchHousehold } from "../data/households";
import { InlineText } from "../components/InlineText";
import { Section } from "../components/Section";
import { HouseholdAliases, HouseholdMembers } from "../components/HouseholdMembers";

const back = (
  <Link to={HOUSEHOLDS_HREF} className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline">
    <ArrowLeft className="size-4" /> Households
  </Link>
);

/**
 * A Household's page (ADR 0117): a hidden route, and its Peek's "Open". Its
 * name, changed where it stands, its members and aliases, and a body of its
 * own. Stacked on a phone.
 */
export function HouseholdScreen() {
  const { id } = useParams<{ id: string }>();
  const row = useDocument<Household>(id);
  const household = useMemo(() => liveHousehold(row), [row]);
  const index = useLinkIndex();
  // Only the body and its Tags are written from the editor, so the members are never sent back as they were.
  const saveBody = useCallback((next: Document) => patchDocument(next.id, { body: next.body, tags: next.tags }), []);

  if (!household) {
    return (
      <Page>
        {back}
        <p className="text-muted-foreground text-sm">No such household here: it may have been deleted, or live in another Workspace.</p>
      </Page>
    );
  }

  return (
    <Page width="wide">
      {back}
      <PageHeader
        title={<InlineText label="Name" required value={household.title} onCommit={(title) => patchHousehold(household.id, { title })} className="-mx-1 py-0 text-xl font-semibold tracking-tight md:text-xl" />}
        documentTitle={household.title}
      />
      {/* A grid track of 22rem: the members' column, as a Person page's cards. */}
      <div className="grid min-w-0 gap-6 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="grid min-w-0 content-start gap-6">
          <Section title="Members">
            <HouseholdMembers household={household} />
          </Section>
          <HouseholdAliases household={household} />
        </div>
        <Section title="About it">
          <div className="min-h-28 min-w-0 rounded-lg border p-2">
            <DocumentEditor key={household.id} doc={household} def={documentType(HOUSEHOLD)} index={index} bodyOnly bodyLabel="About it" save={saveBody} />
          </div>
        </Section>
      </div>
    </Page>
  );
}
