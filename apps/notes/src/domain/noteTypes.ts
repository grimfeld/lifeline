import type * as React from "react";
import {
  Activity, BookOpen, Briefcase, Building2, CalendarDays, Car, Coffee, Dumbbell, FileText, Film, Gamepad2, Gift, GraduationCap, Heart, Home, Landmark, LayoutTemplate,
  Lightbulb, MapPin, Music, Palette, PawPrint, Plane, Quote, Sparkles, Star, Target, User, Users, Utensils, Wrench,
} from "lucide-react";

/** Curated icon set for user-defined types (name → component). Built-ins pick from the same set. */
export const TYPE_ICONS = {
  "file-text": FileText, user: User, users: Users, "map-pin": MapPin, "calendar-days": CalendarDays, "layout-template": LayoutTemplate,
  "book-open": BookOpen, briefcase: Briefcase, building: Building2, car: Car, coffee: Coffee, dumbbell: Dumbbell, film: Film, gamepad: Gamepad2,
  gift: Gift, "graduation-cap": GraduationCap, heart: Heart, home: Home, landmark: Landmark, lightbulb: Lightbulb, music: Music, palette: Palette,
  "paw-print": PawPrint, plane: Plane, quote: Quote, sparkles: Sparkles, star: Star, target: Target, utensils: Utensils, wrench: Wrench, activity: Activity,
} as const;
export type TypeIconName = keyof typeof TYPE_ICONS;
export function typeIcon(name: string | undefined): React.ComponentType<{ className?: string }> {
  return (TYPE_ICONS as Record<string, React.ComponentType<{ className?: string }>>)[name ?? ""] ?? FileText;
}

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
  /** Icon name in TYPE_ICONS (user-defined types are stored by name). */
  iconName?: string;
  /** Default folder for new notes of this type ("" = root; daily/template are fixed by rule). */
  folder?: string;
  /** Built-in types are defined in code and cannot be deleted; user types live in the `note_types` collection. */
  builtIn?: boolean;
  /** A built-in whose label/icon/properties were customised by a user record (reset = delete the record). */
  overridden?: boolean;
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
 * Built-in Note types (ADR 0009, amended): defined in code, extended at run
 * time by user-defined types (`note_types` collection, see data/noteTypes.ts).
 * The engine renders properties as a form and stores them as frontmatter so
 * notes stay portable markdown.
 */
export const BUILTIN_TYPES = [
  {
    id: "daily",
    label: "Daily note",
    plural: "Daily notes",
    icon: CalendarDays,
    iconName: "calendar-days",
    builtIn: true,
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
    iconName: "user",
    builtIn: true,
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
    iconName: "map-pin",
    builtIn: true,
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
    iconName: "file-text",
    builtIn: true,
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
    iconName: "layout-template",
    builtIn: true,
    titleRule: "name",
    properties: [],
    template: "",
    order: 9,
  },
] as const satisfies readonly NoteTypeDef[];

/** Backwards-compatible alias: the built-in registry. Prefer useNoteTypes()/noteType() from data/noteTypes.ts. */
export const NOTE_TYPES = BUILTIN_TYPES;

/**
 * A user-editable template is a Note of type "template" titled with the
 * target type's id ("daily", "person"…). Its content (after any frontmatter)
 * replaces the code default above; placeholders: {{title}}, {{date}}, {{time}}.
 */
export function isTemplatable(t: NoteTypeDef): boolean {
  return t.id !== TEMPLATE_TYPE;
}

/** Type ids are strings: built-in ids plus user-defined slugs. */
export type NoteTypeId = string;

export const TEMPLATE_TYPE: NoteTypeId = "template";
export const PLAIN_TYPE: NoteTypeId = "plain";

/** Slug for a user-defined type from its label: "Recipe idea" → "recipe-idea". */
export function slugify(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function builtinType(id: string): NoteTypeDef | undefined {
  return (BUILTIN_TYPES as readonly NoteTypeDef[]).find((t) => t.id === id);
}
