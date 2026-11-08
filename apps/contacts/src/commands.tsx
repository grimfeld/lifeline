import type { CommandDef } from "@lifeline/core";
import { UserPlus, Users } from "lucide-react";
import { AddPersonDialog } from "./components/AddPersonDialog";
import { addPerson } from "./data/repo";
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
    ],
    returnsDocument: true,
    async invoke(a) {
      const p = await addPerson({ name: String(a.name ?? ""), aliases: a.aliases as string[] | undefined, relationship: a.relationship as string | undefined });
      return { message: `Added ${p.title} to People`, id: p.id };
    },
  },
  { id: "people.open", title: "Go to People", keywords: ["people", "contacts", "persons"], icon: Users, run: ({ navigate }) => navigate(PEOPLE_HREF) },
];
