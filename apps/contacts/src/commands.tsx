import { PERSON_HINT, PERSON_TYPE, peopleArg, peopleIn, peopleNamed, type CommandDef } from "@lifeline/core";
import { CalendarHeart, PhoneCall, UserPlus, Users } from "lucide-react";
import { AddPersonDialog } from "./components/AddPersonDialog";
import { LogExchangeDialog } from "./components/LogExchangeDialog";
import { addOccasion, addPerson } from "./data/repo";
import { PEOPLE_HREF } from "./constants";
import { addExchange } from "./data/exchanges";
import { EXCHANGE_KINDS } from "./domain/exchanges";

/**
 * The Contacts App's Commands. "people.add" is also the agents' `people_add`
 * (#404): its id makes the tool's name, so it keeps it.
 */
export const contactsCommands: CommandDef[] = [
  {
    id: "people.add",
    title: "Add person…",
    keywords: ["person", "people", "contact", "friend", "family", "someone", "met"],
    icon: UserPlus,
    dialog: AddPersonDialog,
    capture: true,
    args: [
      { key: "name", label: "Name", kind: "text", required: true, hint: "Their name, as you'd write it in a [[link]]. Kept as typed as the title." },
      { key: "givenName", label: "Given name", kind: "text", hint: "Optional: their own name (\"Anne\"), kept beside the title; it links to them like an alias." },
      { key: "familyName", label: "Family name", kind: "text", hint: "Optional: the name they share with their family (\"Dupont\"); it never groups people." },
      { key: "aliases", label: "Aliases", kind: "list", hint: "Optional: other names they go by (\"Mum\"); each one links to them." },
      { key: "relationship", label: "Relationship", kind: "text", hint: "Optional: what they are to the user, in the user's words (\"my aunt\")." },
      { key: "tags", label: "Tags", kind: "list", hint: "Optional: Tags to file them under." },
    ],
    returnsDocument: true,
    async invoke(a) {
      const p = await addPerson({ name: String(a.name ?? ""), givenName: a.givenName as string | undefined, familyName: a.familyName as string | undefined, aliases: a.aliases as string[] | undefined, relationship: a.relationship as string | undefined, tags: a.tags as string[] | undefined });
      return { message: `Added ${p.title} to People`, id: p.id };
    },
  },
  {
    id: "people.occasion-add",
    title: "Add occasion…",
    keywords: ["occasion", "birthday", "anniversary", "person", "people"],
    icon: CalendarHeart,
    args: [
      { key: "person", label: "Person", kind: "link", linkType: PERSON_TYPE, required: true, hint: `The Person: ${PERSON_HINT}.` },
      { key: "label", label: "Label", kind: "text", required: true, hint: "\"Birthday\" gives their age; anything else (\"Anniversary\", \"Surgery\") is shown as written." },
      { key: "day", label: "Day", kind: "text", required: true, hint: "YYYY-MM-DD, or MM-DD when the year is unknown (a yearly Occasion only)." },
      { key: "yearly", label: "Yearly", kind: "boolean", hint: "Default true: it falls on that day every year. false: once, on that day (needs the year)." },
    ],
    async invoke(a) {
      const personId = String(a.person);
      const occasion = await addOccasion(personId, { label: String(a.label ?? ""), day: String(a.day ?? ""), yearly: a.yearly !== false });
      return { message: `Added ${occasion.label} (${occasion.day}${occasion.yearly ? ", yearly" : ", once"})${await peopleNamed("to", [personId])}`, id: personId };
    },
  },
  {
    // A record, not a thing: it never collides. A day to come is refused here, so the dialog and an agent are refused alike (ADR 0131).
    id: "people.exchange-add",
    title: "Log an exchange…",
    keywords: ["exchange", "call", "called", "phoned", "video", "message", "texted", "letter", "talked", "spoke", "person", "people"],
    icon: PhoneCall,
    dialog: LogExchangeDialog,
    capture: true,
    args: [
      { ...peopleArg("with", "With", "Who it was with, at least one"), required: true },
      { key: "kind", label: "Kind", kind: "select", options: EXCHANGE_KINDS.map((k) => ({ value: k.value, label: k.label })), hint: "call (the default), video, message or letter." },
      { key: "date", label: "Day", kind: "date", hint: "The day it happened; defaults to today. Never a day to come: plan a call as a Task or an Event." },
      { key: "body", label: "What was said", kind: "longtext", hint: "Optional: what they told you, to have it next time. [[Links]] to others make Backlinks only." },
    ],
    returnsDocument: true,
    async invoke(a) {
      const x = await addExchange({ with: peopleIn(a, "with"), kind: a.kind as string | undefined, date: a.date as string | undefined, body: a.body as string | undefined });
      return { message: `Logged ${x.title} on ${x.date}`, id: x.id };
    },
  },
  { id: "people.open", title: "Go to People", keywords: ["people", "contacts", "persons"], icon: Users, run: ({ navigate }) => navigate(PEOPLE_HREF) },
];
