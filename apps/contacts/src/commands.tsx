import type { CommandDef } from "@lifeline/core";
import { CalendarHeart, UserPlus, Users } from "lucide-react";
import { AddPersonDialog } from "./components/AddPersonDialog";
import { addOccasionByName, addPerson } from "./data/repo";
import { PEOPLE_HREF } from "./constants";

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
      { key: "name", label: "Name", kind: "text", required: true, hint: "Their name, as you'd write it in a [[link]]." },
      { key: "aliases", label: "Aliases", kind: "list", hint: "Optional: other names they go by (\"Mum\"); each one links to them." },
      { key: "relationship", label: "Relationship", kind: "text", hint: "Optional: what they are to the user, in the user's words (\"my aunt\")." },
      { key: "tags", label: "Tags", kind: "list", hint: "Optional: Tags to file them under." },
    ],
    returnsDocument: true,
    async invoke(a) {
      const p = await addPerson({ name: String(a.name ?? ""), aliases: a.aliases as string[] | undefined, relationship: a.relationship as string | undefined, tags: a.tags as string[] | undefined });
      return { message: `Added ${p.title} to People`, id: p.id };
    },
  },
  {
    id: "people.occasion-add",
    title: "Add occasion…",
    keywords: ["occasion", "birthday", "anniversary", "person", "people"],
    icon: CalendarHeart,
    args: [
      { key: "person", label: "Person", kind: "text", required: true, hint: "Their name or an alias; it must be only one Person." },
      { key: "label", label: "Label", kind: "text", required: true, hint: "\"Birthday\" gives their age; anything else (\"Anniversary\", \"Surgery\") is shown as written." },
      { key: "day", label: "Day", kind: "text", required: true, hint: "YYYY-MM-DD, or MM-DD when the year is unknown (a yearly Occasion only)." },
      { key: "yearly", label: "Yearly", kind: "boolean", hint: "Default true: it falls on that day every year. false: once, on that day (needs the year)." },
    ],
    async invoke(a) {
      const { person, occasion } = await addOccasionByName(String(a.person ?? ""), { label: String(a.label ?? ""), day: String(a.day ?? ""), yearly: a.yearly !== false });
      return { message: `Added ${occasion.label} (${occasion.day}${occasion.yearly ? ", yearly" : ", once"}) to ${person.title}`, id: person.id };
    },
  },
  { id: "people.open", title: "Go to People", keywords: ["people", "contacts", "persons"], icon: Users, run: ({ navigate }) => navigate(PEOPLE_HREF) },
];
