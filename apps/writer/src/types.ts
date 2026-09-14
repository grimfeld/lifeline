import { removeDocumentsWhere, vaultDocPath, type Document, type DocumentTypeDef } from "@lifeline/core";

export const APP_ID = "writer";
export const WRITING = "writing";
export const VERSION = "writing_version";
export const WRITINGS_HREF = "/app/writings";
/** A Writing is written in the Vault like every other body (ADR 0045). */
export const writingHref = (id: string) => vaultDocPath(id);

export const STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "revised", label: "Revised" },
  { value: "done", label: "Done" },
] as const;
export type WritingStatus = (typeof STATUSES)[number]["value"];

/** A Writing (CONTEXT.md): prose that is purely my own and *is* the thing. */
export interface Writing extends Document {
  type: typeof WRITING;
  body: string;
  status: WritingStatus;
  /** Free grouping ("Novel", "Blog"). */
  project: string;
}

/** A Version (CONTEXT.md): a deliberate snapshot of a Writing's body. Internal type. */
export interface Version extends Document {
  type: typeof VERSION;
  body: string;
  writingId: string;
  label: string;
  /** ISO instant. */
  takenAt: string;
  words: number;
}

export const writingType: DocumentTypeDef = {
  id: WRITING,
  label: "Writings",
  iconName: "feather",
  titleRule: "name",
  body: "required",
  folder: "Writings",
  linkable: { subtitle: (d) => (d.project ? String(d.project) : undefined) },
  // A Writing is the one type that gets read *aloud* — a Talk (CONTEXT.md) is a
  // Writing given to a room, and the clock is what you want while giving it.
  readTimer: true,
  // No `href`: the default is the Vault's document page, which is where a
  // Writing is now written (ADR 0045). It was the one type that overrode this.
  fields: [
    { key: "status", label: "Status", kind: "select", options: [...STATUSES], column: true },
    { key: "project", label: "Project", kind: "text", column: true },
  ],
  indexes: ["status"],
  /** A Version exists only in service of its Writing, so it goes down with it. */
  onDelete: async (d) => removeDocumentsWhere(VERSION, (v) => v.writingId === d.id),
  order: 25,
  builtIn: true,
};

export const versionType: DocumentTypeDef = {
  id: VERSION,
  label: "Versions",
  iconName: "layout-template",
  internal: true,
  titleRule: "derived",
  titleOf: (d) => String(d.label || "") || `Version ${String(d.takenAt ?? "").slice(0, 16).replace("T", " ")}`,
  body: "required",
  folder: "",
  linkable: false,
  href: (d) => writingHref(String(d.writingId)),
  fields: [
    { key: "writingId", label: "Writing", kind: "link", linkType: WRITING, guarded: true, column: true },
    { key: "label", label: "Label", kind: "text", column: true },
    { key: "takenAt", label: "Taken", kind: "datetime", guarded: true, column: true },
    { key: "words", label: "Words", kind: "number", guarded: true, column: true },
  ],
  indexes: ["writingId"],
  order: 95,
  builtIn: true,
};

export function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}
