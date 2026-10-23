import { conflictCopy, PRIVATE_SETTINGS_TYPE, type DocumentTypeDef } from "@lifeline/core";
import { DAILY, DAILY_TEMPLATE, PERIOD_TEMPLATES, PERIOD_TYPES, TEMPLATE, journalHref, noteHref, periodHref } from "./domain/types";
import { PERIOD_LABELS } from "./domain/periods";

/** UI-free type definitions (icons are attached in index.ts so tests don't pull the UI kit). */
export const noteTypes: DocumentTypeDef[] = [
  {
    id: DAILY,
    // The Day (CONTEXT.md): the id predates the name and stays — it is in every synced row.
    label: "Days",
    iconName: "calendar-days",
    titleRule: "date",
    body: "required",
    // Mood left the daily note for the Mood App (ADR 0044); daily notes are body-only.
    fields: [],
    template: DAILY_TEMPLATE,
    // A date in prose is not a mention of the day; the Daylog ties days together (CONTEXT.md "Unlinked mention").
    linkable: { mentions: false },
    href: (d) => journalHref(d.title),
    onConflict: conflictCopy,
    order: 0,
    builtIn: true,
  },
  ...PERIOD_TYPES.map(
    (id, i): DocumentTypeDef => ({
      id,
      label: PERIOD_LABELS[id].many,
      iconName: "calendar-range",
      titleRule: "name",
      body: "required",
      fields: [],
      template: PERIOD_TEMPLATES[id],
      // Like a Day: a stretch is written about, and prose naming "2026" is not a mention of it.
      linkable: { mentions: false },
      href: (d) => periodHref(d.title),
      onConflict: conflictCopy,
      order: 1 + i,
      builtIn: true,
    }),
  ),
  {
    id: TEMPLATE,
    label: "Templates",
    iconName: "layout-template",
    titleRule: "name",
    body: "required",
    // Every Document type has its own Templates (CONTEXT.md "Template"): `forType` says whose. One titled by a type id is that type's default.
    fields: [{ key: "forType", label: "For type", kind: "text", column: true }],
    folder: "Templates",
    linkable: false,
    href: (d) => noteHref(d),
    order: 90,
    builtIn: true,
  },
  {
    // The Private folder's password (ADR 0038): one internal Document, read by Core's gate by id. A hash and its salt, nothing secret.
    id: PRIVATE_SETTINGS_TYPE,
    label: "Private notes settings",
    iconName: "lock",
    titleRule: "name",
    body: "none",
    internal: true,
    fields: [
      { key: "salt", label: "Salt", kind: "text", hidden: true, guarded: true },
      { key: "hash", label: "Hash", kind: "text", hidden: true, guarded: true },
      { key: "iterations", label: "Iterations", kind: "number", hidden: true, guarded: true },
    ],
    linkable: false,
    order: 99,
    builtIn: true,
  },
];
