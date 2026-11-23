import { conflictCopy, type DocumentTypeDef } from "@lifeline/core";
import { MEMORIES_FOLDER, MEMORY, memoryHref } from "./domain/types";

/**
 * The Memory type (ADR 0136), UI-free: the icon is attached in index.ts so
 * tests don't pull the UI kit. About is one Links field with no type of its
 * own, so the link index lists a Memory in the Backlinks of whatever it is
 * about, with no code of its own.
 */
export const memoryTypeDef: DocumentTypeDef = {
  id: MEMORY,
  label: "Memories",
  singular: "Memory",
  iconName: "images",
  titleRule: "name",
  body: "optional",
  fields: [
    { key: "date", label: "Date", kind: "date", required: true, column: true },
    { key: "about", label: "About", kind: "links", column: true },
  ],
  folder: MEMORIES_FOLDER,
  template: "",
  linkable: true,
  // Opens on its own page under the Journal; its Peek's "Open" leads there.
  href: (d) => memoryHref(d.id),
  onConflict: conflictCopy,
  order: 12,
  builtIn: true,
};
