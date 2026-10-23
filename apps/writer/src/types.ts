import { conflictCopy, removeDocumentsWhere, type Document, type DocumentTypeDef } from "@lifeline/core";

/** The Research App (ADR 0068) — born the Writer's pad; its id stays `writer`, Card ids live in synced layouts. */
export const APP_ID = "writer";
/** The Essay (CONTEXT.md): prose argued from my material. Was `writing` until the split. */
export const ESSAY = "essay";
/** A Version (CONTEXT.md): a deliberate snapshot of an Essay's or a Chapter's body. The id predates the split and stays. */
export const VERSION = "writing_version";
/** The types a Version may be taken of: an Essay here, a Chapter in the Manuscript App. */
export const VERSIONED = [ESSAY, "chapter"] as const;
export const ESSAYS_FOLDER = "Essays";
export const RESEARCH_HREF = "/app/research";
export const essayHref = (id: string) => `/app/research/e/${id}`;

export const STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "revised", label: "Revised" },
  { value: "done", label: "Done" },
] as const;
export type EssayStatus = (typeof STATUSES)[number]["value"];

/** An Essay: argued from material — what it links to, and what I pin to it. */
export interface Essay extends Document {
  type: typeof ESSAY;
  body: string;
  status: EssayStatus;
  /** Material pinned by hand, beyond what the body links (ADR 0068). */
  material: string[];
}

/** A Version (CONTEXT.md): a deliberate snapshot of a body. Internal type. */
export interface Version extends Document {
  type: typeof VERSION;
  body: string;
  /** The Essay or Chapter it is a snapshot of. The key predates the split. */
  writingId: string;
  label: string;
  /** ISO instant. */
  takenAt: string;
  words: number;
}

export const essayType: DocumentTypeDef = {
  id: ESSAY,
  label: "Essays",
  iconName: "feather",
  titleRule: "name",
  body: "required",
  folder: ESSAYS_FOLDER,
  linkable: true,
  // An Essay is what gets read *aloud* — a Talk (CONTEXT.md) is an Essay given to a room, and the clock is what you want while giving it.
  readTimer: true,
  href: (d) => essayHref(d.id),
  fields: [
    { key: "status", label: "Status", kind: "select", options: [...STATUSES], column: true },
    // Pinned in the Research desk's material pane; hidden from the generic form so it is not offered twice.
    { key: "material", label: "Material", kind: "links", hidden: true },
  ],
  indexes: ["status"],
  /** A Version exists only in service of its Essay, so it goes down with it. */
  onDelete: async (d) => removeDocumentsWhere(VERSION, (v) => v.writingId === d.id),
  onConflict: conflictCopy,
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
  fields: [
    { key: "writingId", label: "Of", kind: "link", linkType: [...VERSIONED], guarded: true, column: true },
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
