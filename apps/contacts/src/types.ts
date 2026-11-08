import type { DocumentTypeDef } from "@lifeline/core";
import { PEOPLE_FOLDER, PERSON, type Person } from "./domain/types";
import { personHref } from "./constants";

/**
 * The Person type (ADR 0113), UI-free: the icon and the Peek are attached in
 * index.ts so tests don't pull the UI kit. Its Relationship is the App's own
 * Field; aliases are the Known Field the Linkable Contract reads.
 */
export const personTypeDef: DocumentTypeDef = {
  id: PERSON,
  label: "People",
  singular: "Person",
  iconName: "user",
  titleRule: "name",
  body: "optional",
  folder: PEOPLE_FOLDER,
  linkable: { subtitle: (d) => ((d as Person).relationship?.trim() ? `Person · ${(d as Person).relationship.trim()}` : "Person") },
  // Opens on its own page; its Peek's "Open" leads there (ADR 0110's pattern).
  href: (d) => personHref(d.id),
  order: 30,
  builtIn: true,
  fields: [
    { key: "aliases", label: "Aliases", kind: "list" },
    { key: "relationship", label: "Relationship", kind: "text", column: true },
  ],
};
