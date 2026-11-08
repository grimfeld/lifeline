import type { AppManifest } from "@lifeline/core";
import { lazyChunk } from "@lifeline/ui";
import { Link2, User, Users } from "lucide-react";
import { contactsCommands } from "./commands";
import { personTypeDef, tieTypeDef } from "./types";
import { PersonPeek } from "./components/PersonFields";
import { AddPersonDialog } from "./components/AddPersonDialog";
import { UpcomingCard } from "./components/UpcomingReport";
import { contactsTimed } from "./timed";

// Screens load on first visit (ADR 0099); the rest of the manifest stays eager.
const PeopleScreen = lazyChunk(() => import("./screens/PeopleScreen").then((m) => ({ default: m.PeopleScreen })));
const PersonScreen = lazyChunk(() => import("./screens/PersonScreen").then((m) => ({ default: m.PersonScreen })));

/**
 * Contacts App (ADR 0113): the people in my life, as the built-in Person. The
 * People Module's one App. Its domain is `src/domain` (the Person and where
 * its parts are kept), its writes `src/data/repo.ts`, and the Person page's
 * section slots `src/screens/sections.tsx`.
 */
export const contactsApp: AppManifest = {
  id: "contacts",
  module: "people",
  title: "Contacts",
  icon: Users,
  color: "var(--chart-aqua)",
  types: [{ ...personTypeDef, icon: User, peekEdit: PersonPeek }, { ...tieTypeDef, icon: Link2 }],
  screens: [
    { id: "contacts.people", title: "People", path: "people", icon: Users, component: PeopleScreen },
    // The Person page: routed, never listed — reached from the Peek's "Open", a Base or the Vault.
    { id: "contacts.person", title: "Person", path: "people/person/:id", component: PersonScreen, hidden: true },
  ],
  cards: [
    {
      id: "contacts.upcoming",
      title: "Upcoming",
      description: "The Occasions in the next days: birthdays with the age they reach, soonest first",
      component: UpcomingCard,
      defaultSize: { w: 4, h: 5 },
      minSize: { w: 3, h: 3 },
      settings: { days: { kind: "number", label: "Days ahead", default: 30, min: 1, max: 365 } },
    },
  ],
  commands: contactsCommands,
  timed: contactsTimed,
  // From the Selection menu, the selected name becomes a link to the Person made.
  intakes: [{ id: "person", title: "Person", icon: User, dialog: AddPersonDialog, links: true }],
};

export { PERSON, TIE, type Person, type Tie } from "./domain/types";
