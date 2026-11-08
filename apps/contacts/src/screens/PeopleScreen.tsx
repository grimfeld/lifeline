import { useMemo, useState } from "react";
import { seenDays, todayStr, useLinkIndex, type DateStr } from "@lifeline/core";
import { Button, EmptyState, Input, Page, PageHeader, PhoneDock, PhoneFilters, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@lifeline/ui";
import { UserPlus } from "lucide-react";
import { UpcomingReport } from "../components/UpcomingReport";
import { DriftingSection } from "../components/DriftingSection";
import { AddPersonDialog } from "../components/AddPersonDialog";
import { PersonRowLink, RelationshipLabel } from "../components/PersonRow";
import { Section } from "../components/Section";
import { everyone, relationshipsOf, tagsOf } from "../domain/everyone";
import { type Person } from "../domain/types";
import { normalizePerson, usePeople } from "../data/repo";

const ANY = "__any__";

/** One Person in Everyone: their name and what they are to me, a link to their page. */
function PersonRow({ person, lastSeen }: { person: Person; lastSeen?: DateStr }) {
  return (
    <li>
      <PersonRowLink personId={person.id}>
        <span className="min-w-0 flex-1 truncate font-medium">{person.title}</span>
        {person.relationship && <RelationshipLabel>{person.relationship}</RelationshipLabel>}
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{lastSeen ? `Last seen ${lastSeen}` : "Not seen"}</span>
      </PersonRowLink>
    </li>
  );
}

/**
 * The People Module's home (#404 story 67): Upcoming, then Drifting, then
 * Everyone. Everyone is every Person in the Workspace, searched by name and
 * alias and filtered by Relationship and Tag.
 */
export function PeopleScreen() {
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [relationship, setRelationship] = useState("");
  const [tag, setTag] = useState("");
  const rows = usePeople();
  const people = useMemo(() => rows.map(normalizePerson), [rows]);
  const shown = useMemo(() => everyone(people, { query, relationship, tag }), [people, query, relationship, tag]);
  const index = useLinkIndex();
  const today = todayStr();
  const lastSeenOf = (id: string) => seenDays(index, id, today).at(-1);
  const relationships = useMemo(() => relationshipsOf(people), [people]);
  const tags = useMemo(() => tagsOf(people), [people]);
  // A filter whose value no one carries any more (the last of them was changed) is no filter.
  const activeRelationship = relationships.includes(relationship) ? relationship : "";
  const activeTag = tags.includes(tag) ? tag : "";
  const add = (
    <Button onClick={() => setAdding(true)}>
      <UserPlus /> Add person
    </Button>
  );

  return (
    <Page>
      <PageHeader title="People">{people.length > 0 ? add : null}</PageHeader>

      {/* UPCOMING (#416): the Occasions in the next days. Goes here, above Drifting. */}
      <UpcomingReport />

      {/* DRIFTING (#420): who I have not seen for a while. Goes here, between Upcoming and Everyone. */}
      {people.length > 0 && <DriftingSection people={people} />}

      <Section title="Everyone">
        {people.length === 0 ? (
          <EmptyState action={add}>The people in your life. Add someone, then link them from any page with [[their name]].</EmptyState>
        ) : (
          <>
            <PhoneDock>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 max-md:contents">
                <Input aria-label="Search people" className="flex-1 md:min-w-40 max-md:w-auto max-md:basis-36" placeholder="Search name or alias…" value={query} onChange={(e) => setQuery(e.target.value)} />
                <PhoneFilters active={+(activeRelationship !== "") + +(activeTag !== "")}>
                  <Select value={activeRelationship || ANY} onValueChange={(v) => setRelationship(v === ANY ? "" : v)}>
                    <SelectTrigger className="w-full min-w-0 md:w-48" aria-label="Relationship">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY}>Any relationship</SelectItem>
                      {relationships.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={activeTag || ANY} onValueChange={(v) => setTag(v === ANY ? "" : v)}>
                    <SelectTrigger className="w-full min-w-0 md:w-48" aria-label="Tag">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY}>Any tag</SelectItem>
                      {tags.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </PhoneFilters>
              </div>
            </PhoneDock>
            {shown.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nobody matches that.</p>
            ) : (
              <ul className="grid min-w-0 gap-2">
                {shown.map((p) => (
                  <PersonRow key={p.id} person={p} lastSeen={lastSeenOf(p.id)} />
                ))}
              </ul>
            )}
          </>
        )}
      </Section>
      <AddPersonDialog open={adding} onOpenChange={setAdding} />
    </Page>
  );
}
