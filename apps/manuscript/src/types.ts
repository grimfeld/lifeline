import { documentsWhere, removeDocumentsWhere, type DocumentTypeDef } from "@lifeline/core";
import { VERSION } from "@lifeline/app-writer";
import { CHAPTER, FORMS, MANUSCRIPT, MANUSCRIPTS_FOLDER, OUTTAKE, STATUSES, manuscriptHref } from "./domain/types";

/** A Manuscript: a creative work of ordered Chapters; its body is the outline and the plan. */
export const manuscriptType: DocumentTypeDef = {
  id: MANUSCRIPT,
  label: "Manuscripts",
  iconName: "book-open-text",
  titleRule: "name",
  body: "required",
  folder: MANUSCRIPTS_FOLDER,
  template: "## Premise\n\n## Outline\n\n## Plan\n\n",
  linkable: true,
  href: (d) => manuscriptHref(d.id),
  fields: [
    { key: "form", label: "Form", kind: "select", options: [...FORMS], column: true },
    { key: "status", label: "Status", kind: "select", options: [...STATUSES], column: true },
  ],
  /** Its Chapters and Outtakes exist only as its parts, so they go with it — Chapters' Versions too. */
  onDelete: async (d) => {
    const chapters = await documentsWhere(CHAPTER, "manuscriptId", d.id);
    const ids = new Set(chapters.map((c) => c.id));
    await removeDocumentsWhere(VERSION, (v) => ids.has(String(v.writingId)));
    await removeDocumentsWhere(CHAPTER, (c) => c.manuscriptId === d.id);
    await removeDocumentsWhere(OUTTAKE, (o) => o.manuscriptId === d.id);
  },
  order: 26,
  builtIn: true,
};

/** A Chapter: one ordered part of a Manuscript, with a body of its own. */
export const chapterType: DocumentTypeDef = {
  id: CHAPTER,
  label: "Chapters",
  iconName: "file-text",
  titleRule: "name",
  body: "required",
  folder: MANUSCRIPTS_FOLDER,
  linkable: true,
  href: (d) => manuscriptHref(String(d.manuscriptId), d.id),
  fields: [
    { key: "manuscriptId", label: "Manuscript", kind: "link", linkType: MANUSCRIPT, guarded: true, required: true, column: true },
    { key: "position", label: "Order", kind: "number", guarded: true, column: true },
    { key: "status", label: "Status", kind: "select", options: [...STATUSES], column: true },
  ],
  indexes: ["manuscriptId"],
  /** Its Versions go with it. */
  onDelete: async (d) => removeDocumentsWhere(VERSION, (v) => v.writingId === d.id),
  order: 27,
  builtIn: true,
};

/** An Outtake: a passage cut from a Chapter, kept with its Manuscript. Internal. */
export const outtakeType: DocumentTypeDef = {
  id: OUTTAKE,
  label: "Outtakes",
  iconName: "scissors",
  internal: true,
  titleRule: "derived",
  titleOf: (d) => {
    const t = String(d.body ?? "").replace(/\s+/g, " ").trim();
    return t.length > 48 ? t.slice(0, 47) + "…" : t || "Outtake";
  },
  body: "required",
  folder: "",
  linkable: false,
  href: (d) => manuscriptHref(String(d.manuscriptId)),
  fields: [
    { key: "manuscriptId", label: "Manuscript", kind: "link", linkType: MANUSCRIPT, guarded: true, column: true },
    { key: "chapterId", label: "Cut from", kind: "link", linkType: CHAPTER, guarded: true, column: true },
    { key: "cutAt", label: "Cut", kind: "datetime", guarded: true, column: true },
  ],
  indexes: ["manuscriptId"],
  order: 96,
  builtIn: true,
};
