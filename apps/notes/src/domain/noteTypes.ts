import type * as React from "react";
import { CalendarDays, FileText, LayoutTemplate, MapPin, User } from "lucide-react";

/** A typed Property of a Note type; values live in the note's frontmatter. */
export type PropertyDef =
  | { key: string; label: string; kind: "text" }
  | { key: string; label: string; kind: "number" }
  | { key: string; label: string; kind: "date" }
  | { key: string; label: string; kind: "select"; options: { value: string; label: string }[] }
  | { key: string; label: string; kind: "list" }
  /** Coordinates, stored as `[lat, lon]` (the shape Obsidian Map View reads; ADR 0011). */
  | { key: string; label: string; kind: "geo" };

export interface NoteTypeDef {
  id: string;
  label: string;
  plural: string;
  icon: React.ComponentType<{ className?: string }>;
  /** "date": title is a YYYY-MM-DD day, at most one note per day. "name": free unique title. */
  titleRule: "date" | "name";
  properties: PropertyDef[];
  /** Body template for a new note (after the frontmatter). */
  template: string;
  /** Sort order in pickers. */
  order: number;
}

export const MOODS = [
  { value: "1", label: "😞 Rough" },
  { value: "2", label: "😕 Meh" },
  { value: "3", label: "😐 Okay" },
  { value: "4", label: "🙂 Good" },
  { value: "5", label: "😄 Great" },
];

/**
 * Compile-time Note type registry (ADR 0009). Adding a type is adding an
 * entry; the engine renders properties as a form and stores them as
 * frontmatter so notes stay portable markdown.
 */
export const NOTE_TYPES = [
  {
    id: "daily",
    label: "Daily note",
    plural: "Daily notes",
    icon: CalendarDays,
    titleRule: "date",
    properties: [{ key: "mood", label: "Mood", kind: "select", options: MOODS }],
    template: "```daylog\n```\n\n### Histoire du jour\n\n---\n### Citation du jour\n\n---\n### Quoi de neuf ?\n\n---\n### Et maintenant ?\n\n",
    order: 0,
  },
  {
    id: "person",
    label: "Person",
    plural: "People",
    icon: User,
    titleRule: "name",
    properties: [
      { key: "aliases", label: "Aliases", kind: "list" },
      {
        key: "relationship",
        label: "Relationship",
        kind: "select",
        options: [
          { value: "family", label: "Family" },
          { value: "friend", label: "Friend" },
          { value: "colleague", label: "Colleague" },
          { value: "acquaintance", label: "Acquaintance" },
          { value: "other", label: "Other" },
        ],
      },
      { key: "birthday", label: "Birthday", kind: "date" },
    ],
    template: "",
    order: 1,
  },
  {
    id: "place",
    label: "Place",
    plural: "Places",
    icon: MapPin,
    titleRule: "name",
    properties: [
      { key: "aliases", label: "Aliases", kind: "list" },
      { key: "address", label: "Address", kind: "text" },
      { key: "location", label: "Coordinates", kind: "geo" },
      {
        key: "kind",
        label: "Kind",
        kind: "select",
        options: [
          { value: "home", label: "Home" },
          { value: "restaurant", label: "Restaurant" },
          { value: "city", label: "City" },
          { value: "venue", label: "Venue" },
          { value: "other", label: "Other" },
        ],
      },
    ],
    template: "",
    order: 2,
  },
  {
    id: "plain",
    label: "Note",
    plural: "Notes",
    icon: FileText,
    titleRule: "name",
    properties: [{ key: "aliases", label: "Aliases", kind: "list" }],
    template: "",
    order: 3,
  },
  {
    id: "template",
    label: "Template",
    plural: "Templates",
    icon: LayoutTemplate,
    titleRule: "name",
    properties: [],
    template: "",
    order: 9,
  },
] as const satisfies readonly NoteTypeDef[];

/**
 * A user-editable template is a Note of type "template" titled with the
 * target type's id ("daily", "person"…). Its content (after any frontmatter)
 * replaces the code default above; placeholders: {{title}}, {{date}}, {{time}}.
 */
export function isTemplatable(t: NoteTypeDef): boolean {
  return t.id !== TEMPLATE_TYPE;
}

export type NoteTypeId = (typeof NOTE_TYPES)[number]["id"];

export const TEMPLATE_TYPE: NoteTypeId = "template";

export function noteType(id: string): NoteTypeDef {
  return (NOTE_TYPES as readonly NoteTypeDef[]).find((t) => t.id === id) ?? NOTE_TYPES[3];
}

