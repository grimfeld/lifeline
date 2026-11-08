import { allDocumentTypes, allDocuments, buildLinkIndex, documentFigures, inPrivateFolder, seenDays, todayStr, type Document, type DocumentFigures } from "@lifeline/core";
import { tiesSeenFrom } from "./domain/ties";
import { allPeople } from "./data/repo";
import { tiesOf } from "./data/ties";

/** What an agent may count or name: nothing in the Private folder (ADR 0038), whose gate an agent never opens. */
const agentMaySee = (d: Pick<Document, "folder">) => !inPrivateFolder(d.folder);

const figure = (f: DocumentFigures) => ({ last: f.last, daysAgo: f.sinceLast, thisYear: f.thisYear, allTime: f.allTime });

/**
 * A Person as an agent reads it beyond its Fields (`describe`, ADR 0098): their
 * Ties, read from their side, and their Last seen and Last mentioned (ADR
 * 0112), as their page shows them. Ties to People in the Private folder are
 * left out, and nothing there is counted. The agent wall (ADR 0114) is the
 * server's: nothing here reads Addresses or Contact details.
 */
export async function describePerson(person: Document): Promise<Record<string, unknown>> {
  const today = todayStr();
  const visible = (await allDocuments()).filter(agentMaySee);
  const index = buildLinkIndex(visible, allDocumentTypes());
  const people = (await allPeople()).filter(agentMaySee);
  const ties = tiesSeenFrom(person.id, await tiesOf(person.id), people).map((t) => ({ label: t.label, id: t.otherId, title: t.otherName }));
  return {
    ties,
    reports: {
      lastSeen: figure(documentFigures(index, person.id, today, (i, id) => seenDays(i, id, today))),
      lastMentioned: figure(documentFigures(index, person.id, today)),
    },
  };
}
