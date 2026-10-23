import { conflictCopy, type DocumentTypeDef } from "@lifeline/core";
import { THOUGHT, THOUGHT_KINDS, THOUGHTS_FOLDER, thoughtHref } from "./domain/types";

/** UI-free type definition (the icon is attached in index.ts so tests don't pull the UI kit). */
export const thoughtTypeDef: DocumentTypeDef = {
  id: THOUGHT,
  label: "Thoughts",
  iconName: "lightbulb",
  titleRule: "name",
  body: "required",
  fields: [
    { key: "kind", label: "Kind", kind: "select", options: THOUGHT_KINDS.map((k) => ({ value: k.value, label: k.label })), column: true },
    { key: "aliases", label: "Aliases", kind: "list" },
  ],
  folder: THOUGHTS_FOLDER,
  template: "",
  linkable: true,
  href: (d) => thoughtHref(d.id),
  onConflict: conflictCopy,
  order: 10,
  builtIn: true,
};
