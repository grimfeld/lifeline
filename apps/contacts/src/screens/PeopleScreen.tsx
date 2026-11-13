import { useMemo, useState } from "react";
import { Link } from "react-router";
import { todayStr, useLinkIndex, type DateStr } from "@lifeline/core";
import { Badge, Button, EmptyState, Input, Page, PageHeader, PhoneDock, PhoneFilters, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, ToggleGroup, ToggleGroupItem } from "@lifeline/ui";
import { UserPlus } from "lucide-react";
import { UPCOMING_DAYS, UpcomingStrip } from "../components/UpcomingReport";
import { DriftingSection } from "../components/DriftingSection";
import { AddPersonDialog } from "../components/AddPersonDialog";
import { Section } from "../components/Section";
import { activeFilter, byLetter, everyone, lastSeenLabel, relationshipsOf, rowNews, tagsOf, type RowNews } from "../domain/everyone";
import { type Person } from "../domain/types";
import { personHref } from "../constants";
import { driftingFrom, lastDays, type DriftSource } from "../domain/drifting";
import { NextOccasionBadge, TagBadges } from "../components/Badges";
import { usePeople } from "../data/repo";

const ANY = "__any__";

/** One Person in Everyone: their name, badges for what they are to me, what comes up and their Tags, and when last seen; a link to their page. */
function PersonRow({ person, lastSeen, news, showRelationship }: { person: Person; lastSeen?: DateStr; news: RowNews; showRelationship: boolean }) {
  const soon = news.upcoming.get(person.id);
  const drift = news.drifting.get(person.id);
  return (
    <li>
      <Link
        to={personHref(person.id)}
        className="hover:bg-accent focus-visible:ring-ring flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-2 py-2 focus-visible:ring-2 focus-visible:outline-none"
      >
        <span className="min-w-0 truncate font-medium">{person.title}</span>
        <span className="flex min-w-0 flex-wrap gap-1">
          {showRelationship && person.relationship && (
            <Badge variant="secondary" className="max-w-full">
              <span className="min-w-0 truncate">{person.relationship}</span>
            </Badge>
          )}
          {soon && <NextOccasionBadge next={soon} variant="default" bareAge />}
          {drift !== undefined && (
            <Badge variant="outline" className="text-warning">
              {drift === null ? "drifting" : `drifting · ${drift} days`}
            </Badge>
          )}
          <TagBadges tags={person.tags} variant="outline" />
        </span>
        <span className="text-muted-foreground ml-auto shrink-0 text-xs tabular-nums">{lastSeenLabel(lastSeen)}</span>
      </Link>
    </li>
  );
}

/** One of Everyone's filters: its values in use, or any ("" when none is picked). */
function FilterSelect({ label, anyLabel, value, options, onChange }: { label: string; anyLabel: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return (
    <Select value={value || ANY} onValueChange={(v) => onChange(v === ANY ? "" : v)}>
      <SelectTrigger className="w-full min-w-0 md:w-48" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>{anyLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * The People Module's home (#404 story 67, #422): Upcoming as a strip of
 * days, then Drifting, then Everyone. Everyone is every Person in the
 * Workspace A to Z, searched by name and alias and filtered by Relationship
 * and Tag, each row with badges for what is coming up and who is drifting.
 */
export function PeopleScreen() {
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [relationship, setRelationship] = useState("");
  const [tag, setTag] = useState("");
  const people = usePeople();
  const shown = useMemo(() => everyone(people, { query, relationship, tag }), [people, query, relationship, tag]);
  const index = useLinkIndex();
  const today = todayStr();
  // Drifting by Seen or by Mentioned: the Drifting section's switch, and the row badges follow it.
  const [driftSource, setDriftSource] = useState<DriftSource>("seen");
  // Seen walks every Event that links to a Person: once per change to the index, never per keystroke in the search.
  // Drifting reuses it; Mentioned is walked only while the switch is on it.
  const lastSeen = useMemo(() => lastDays(index, people, { source: "seen", today }), [index, people, today]);
  const lastMentioned = useMemo(() => (driftSource === "mentioned" ? lastDays(index, people, { source: "mentioned", today }) : null), [driftSource, index, people, today]);
  const drifters = useMemo(() => driftingFrom(people, lastMentioned ?? lastSeen, today), [people, lastMentioned, lastSeen, today]);
  const news = useMemo<RowNews>(() => rowNews(people, drifters, today, UPCOMING_DAYS), [people, drifters, today]);
  const relationships = useMemo(() => relationshipsOf(people), [people]);
  const tags = useMemo(() => tagsOf(people), [people]);
  // A filter whose value no one carries any more (the last of them was changed) is no filter.
  const activeRelationship = activeFilter(relationships, relationship);
  const activeTag = activeFilter(tags, tag);
  const add = (
    <Button onClick={() => setAdding(true)}>
      <UserPlus /> Add person
    </Button>
  );

  return (
    <Page>
      <PageHeader title="People">{people.length > 0 ? add : null}</PageHeader>

      {/* UPCOMING (#416): the Occasions in the next days. Goes here, above Drifting. */}
      <UpcomingStrip />

      {/* DRIFTING (#420): who I have not seen for a while. Goes here, between Upcoming and Everyone. */}
      {people.length > 0 && <DriftingSection rows={drifters} source={driftSource} onSourceChange={setDriftSource} />}

      <Section title="Everyone">
        {people.length === 0 ? (
          <EmptyState action={add}>The people in your life. Add someone, then link them from any page with [[their name]].</EmptyState>
        ) : (
          <>
            <PhoneDock>
              <div className="grid min-w-0 flex-1 gap-2 max-md:contents">
                <Input aria-label="Search people" className="max-md:w-auto max-md:basis-36" placeholder="Search name or alias…" value={query} onChange={(e) => setQuery(e.target.value)} />
                <PhoneFilters active={+(activeRelationship !== "") + +(activeTag !== "")}>
                  <div className="flex min-w-0 flex-wrap items-center gap-2 max-md:contents">
                    {relationships.length > 0 && (
                      <ToggleGroup aria-label="Relationship" value={activeRelationship || ANY} onValueChange={(v) => setRelationship(v === ANY ? "" : v)}>
                        <ToggleGroupItem value={ANY}>Everyone</ToggleGroupItem>
                        {relationships.map((r) => (
                          <ToggleGroupItem key={r} value={r} title={r} className="min-w-0">
                            <span className="max-w-[16rem] min-w-0 truncate">{r}</span>
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    )}
                    <FilterSelect label="Tag" anyLabel="Any tag" value={activeTag} options={tags} onChange={setTag} />
                  </div>
                </PhoneFilters>
              </div>
            </PhoneDock>
            {shown.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nobody matches that.</p>
            ) : (
              <div className="grid min-w-0 gap-4">
                {/* Each letter's section has a 2rem track for the letter: one capital, with room before the names. */}
                {byLetter(shown).map(([letter, ps]) => (
                  <section key={letter} className="grid min-w-0 gap-1 md:grid-cols-[2rem_minmax(0,1fr)]">
                    <h3 className="text-muted-foreground px-2 pt-2 text-sm font-medium md:px-0">{letter}</h3>
                    <ul className="grid min-w-0">
                      {ps.map((p) => (
                        <PersonRow key={p.id} person={p} lastSeen={lastSeen.get(p.id)} news={news} showRelationship={!activeRelationship} />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </Section>
      <AddPersonDialog open={adding} onOpenChange={setAdding} />
    </Page>
  );
}
