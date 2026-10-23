import { conflictCopy, type DocumentTypeDef, type RoleDef } from "@lifeline/core";
import { NotebookPen, Quote as QuoteIcon, Radio } from "lucide-react";
import { NOTE, NOTES_FOLDER, QUOTES, QUOTES_FOLDER, SOURCE, SOURCE_KINDS, SOURCE_ROLE, SOURCES_FOLDER, TOPIC_TYPE, noteHref, quoteHref, sourceHref, sourceKindLabel, type Quote } from "./domain/types";
import { WORK_TYPE_IDS } from "./domain/works";
import { quoteName } from "./domain/quotes";

/**
 * My own words never become a Source (CONTEXT.md "Role"): what I write *from*
 * a Source cannot be one. Named here by id — the types belong to other Apps,
 * but which of them may wear this App's Role is this App's call.
 */
const OWN_WORDS = new Set([NOTE, QUOTES, "thought", "daily", "week", "month", "quarter", "year", "essay", "writing_version", "manuscript", "chapter", "outtake", "template"]);

/**
 * The Source Role (ADR 0069, ADR 0070): what makes a Document somewhere to take
 * Notes and Quotes from. Its home is the Source type; every work plays it by
 * construction; any other Linkable Document that is not my own words may put
 * it on — a Person I heard speak. It lends no Fields: being a hub is the point.
 */
export const sourceRole: RoleDef = {
  id: SOURCE_ROLE,
  label: "Source",
  homeType: SOURCE,
  playedBy: [...WORK_TYPE_IDS],
  fields: [],
  wearable: (def) => !!def.linkable && !OWN_WORDS.has(def.id),
};

/** The Source (ADR 0070): an article, a podcast, an episode, a video — what is nobody else's. Works keep their own types. */
export const sourceTypeDef: DocumentTypeDef = {
  id: SOURCE,
  label: "Sources",
  icon: Radio,
  iconName: "radio",
  titleRule: "name",
  body: "optional",
  folder: SOURCES_FOLDER,
  linkable: { subtitle: (d) => sourceKindLabel(d.kind as string) ?? "Source" },
  href: (d) => sourceHref(d.id),
  indexes: ["parent"],
  order: 44,
  builtIn: true,
  fields: [
    { key: "kind", label: "Kind", kind: "select", options: SOURCE_KINDS.map((k) => ({ value: k.value, label: k.label })), column: true },
    { key: "url", label: "URL", kind: "url", column: true },
    { key: "author", label: "Author", kind: "text", column: true },
    { key: "publishedOn", label: "Published", kind: "date" },
    { key: "parent", label: "Part of", kind: "link", linkRole: SOURCE_ROLE },
    { key: "aliases", label: "Aliases", kind: "list" },
  ],
};

/** The Note (ADR 0070): my words on a Source, impossible without it. */
export const noteTypeDef: DocumentTypeDef = {
  id: NOTE,
  label: "Notes",
  icon: NotebookPen,
  iconName: "notebook-pen",
  titleRule: "name",
  body: "required",
  folder: NOTES_FOLDER,
  template: "",
  linkable: true,
  href: (d) => noteHref(d.id),
  indexes: ["source"],
  onConflict: conflictCopy,
  order: 45,
  builtIn: true,
  fields: [
    { key: "source", label: "Source", kind: "link", linkRole: SOURCE_ROLE, required: true, column: true },
    { key: "locator", label: "Where", kind: "text", column: true },
    { key: "aliases", label: "Aliases", kind: "list" },
  ],
};

/**
 * The Quote (ADR 0070): a passage taken from a Source — its body — impossible
 * without the Source it links to. Titled by its opening words unless it was
 * given one (a kept Clipping keeps its headline).
 */
export const quoteTypeDef: DocumentTypeDef = {
  id: QUOTES,
  label: "Quotes",
  icon: QuoteIcon,
  iconName: "quote",
  titleRule: "derived",
  titleOf: (d) => `“${quoteName((d as Quote).body ?? "")}”`,
  body: "required",
  folder: QUOTES_FOLDER,
  linkable: { subtitle: () => "Quote" },
  href: (d) => quoteHref(d as Quote),
  indexes: ["source", "capturedOn"],
  onConflict: conflictCopy,
  order: 46,
  builtIn: true,
  fields: [
    { key: "source", label: "Source", kind: "link", linkRole: SOURCE_ROLE, required: true, guarded: true, column: true },
    { key: "locator", label: "Where", kind: "text", column: true },
    { key: "comment", label: "Comment", kind: "longtext" },
    { key: "capturedOn", label: "Captured on", kind: "date", guarded: true, column: true },
    { key: "kept", label: "Kept", kind: "boolean", guarded: true, column: true },
    { key: "topic", label: "Kept in", kind: "link", linkType: TOPIC_TYPE, guarded: true },
    { key: "keptAt", label: "Kept since", kind: "datetime", guarded: true, hidden: true },
  ],
};
