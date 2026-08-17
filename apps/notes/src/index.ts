import type { AppManifest, BacklinkProvider, CardSettings, LocatableProvider, Pin } from "@lifeline/core";
import { NotebookPen } from "lucide-react";
import { JournalScreen } from "./screens/JournalScreen";
import { NotesSidebar } from "./workspace/NotesSidebar";
import { NoteScreen } from "./screens/NoteScreen";
import { TodayJournalCard } from "./cards/TodayJournalCard";
import { DaylogCard } from "./cards/DaylogCard";
import { RecentNotesCard, useRecentTypeOptions } from "./cards/RecentNotesCard";
import { noteCommands, useNoteTypeCommands } from "./commands";
import { onNoteConflict, useNoteIndex, useNotes } from "./data/repo";
import { NOTES } from "./domain/types";
import { NOTE_TYPES_COLLECTION } from "./data/noteTypes";
import { formatHuman, addDays, todayStr } from "@lifeline/core";
import { excerpt, extractTags, noteCoords, splitFrontmatter } from "./domain/markdown";
import { noteType } from "./data/noteTypes";
import { notesTaggable } from "./taggable";

const APP_ID = "notes";

/** The Notes App answers "mentioned in" for every other App's Linkable entities (ADR 0009). */
const notesBacklinks: BacklinkProvider = {
  appId: APP_ID,
  useBacklinks(target) {
    const index = useNoteIndex();
    return index.backlinksTo({ kind: "app", appId: target.appId, itemId: target.itemId }).map((b) => {
      const n = index.byId.get(b.noteId);
      return {
        appId: APP_ID,
        sourceId: b.noteId,
        title: n ? (n.type === "daily" ? formatHuman(n.title) : n.title) : "?",
        excerpt: b.context || excerpt(n?.body ?? "", 100),
        href: n ? (n.type === "daily" ? `/notes/journal?d=${n.title}` : `/notes/n/${n.id}`) : undefined,
      };
    });
  },
};

/** Any note with a valid `location` property is a Pin — Places first, but the contract is about data, not type (ADR 0011). */
const notesLocatable: LocatableProvider = {
  appId: APP_ID,
  usePins() {
    const notes = useNotes();
    const out: Pin[] = [];
    for (const n of notes) {
      const props = splitFrontmatter(n.body).properties;
      const geoKey = noteType(n.type).properties.find((p) => p.kind === "geo")?.key;
      const c = noteCoords(props, geoKey);
      if (!c) continue;
      const address = typeof props.address === "string" && props.address ? props.address : noteType(n.type).label;
      out.push({ appId: APP_ID, itemId: n.id, name: n.title, subtitle: address, lat: c.lat, lon: c.lon, href: `/notes/n/${n.id}`, tags: extractTags(n.body) });
    }
    return out;
  },
};

const offsetKnob = { kind: "number" as const, label: "Day offset", default: 0, min: -365, max: 0 };
const offsetTitle = (base: string) => (s: CardSettings) => {
  const o = Number(s.offset ?? 0);
  return o === 0 ? base : o === -1 ? `${base} · yesterday` : `${base} · ${formatHuman(addDays(todayStr(), o))}`;
};

/** Notes App (ADR 0009): markdown notes with typed Note types; the Journal is its daily-note Surface. */
export const notesApp: AppManifest = {
  id: APP_ID,
  title: "Notes",
  icon: NotebookPen,
  color: "var(--chart-green)",
  collections: [
    { name: NOTES, indexes: ["type", "title", "folder"], onConflict: onNoteConflict },
    { name: NOTE_TYPES_COLLECTION, indexes: ["typeId", "order"] },
  ],
  /** The Notes workspace (ADR 0012): Core frames it, this App supplies the sidebar and the screens below /notes. */
  workspace: { id: "notes", title: "Notes", icon: NotebookPen, path: "/notes", sidebar: NotesSidebar, home: "journal" },
  screens: [
    { id: "notes.journal", title: "Journal", path: "journal", icon: NotebookPen, component: JournalScreen, workspace: "notes" },
    { id: "notes.detail", title: "Note", path: "n/:id", component: NoteScreen, hidden: true, workspace: "notes" },
  ],
  cards: [
    {
      id: "notes.today",
      title: "Journal",
      description: "A day's journal entry at a glance — click to write",
      component: TodayJournalCard,
      defaultSize: { w: 4, h: 6 },
      minSize: { w: 2, h: 3 },
      settings: { offset: offsetKnob },
      instanceTitle: offsetTitle("Journal"),
    },
    {
      id: "notes.daylog",
      title: "Daylog",
      description: "What happened on a day, across every app",
      component: DaylogCard,
      defaultSize: { w: 3, h: 6 },
      minSize: { w: 2, h: 3 },
      settings: { offset: offsetKnob },
      instanceTitle: offsetTitle("Daylog"),
      tagFilterable: true,
    },
    {
      id: "notes.recent",
      title: "Recent notes",
      description: "The notes you touched last",
      component: RecentNotesCard,
      defaultSize: { w: 3, h: 6 },
      minSize: { w: 2, h: 3 },
      settings: {
        type: { kind: "entity", label: "Type", useOptions: useRecentTypeOptions, anyLabel: "All types" },
        count: { kind: "number", label: "How many", default: 8, min: 1, max: 50 },
      },
      instanceTitle: (s) => (s.type ? `Recent ${noteType(String(s.type)).plural.toLowerCase()}` : ""),
      tagFilterable: true,
    },
  ],
  commands: noteCommands,
  useCommands: useNoteTypeCommands,
  backlinks: notesBacklinks,
  locatable: notesLocatable,
  taggable: notesTaggable,
};

export { NOTES };
export type { Note } from "./domain/types";
export { BUILTIN_TYPES, type NoteTypeId } from "./domain/noteTypes";
export { useNoteTypes, noteType } from "./data/noteTypes";
export { DaylogBlock } from "./components/DaylogBlock";
