import { useEffect } from "react";
import { addDays, documentType, formatHuman, PRIVATE_SETTINGS_TYPE, repairPrivateSettings, todayStr, VAULT_WORKSPACE, type AppManifest, type CardSettings } from "@lifeline/core";
import { CalendarDays, FileText, LayoutTemplate, Lock, NotebookPen } from "lucide-react";
import { JournalScreen } from "./screens/JournalScreen";
import { TodayJournalCard } from "./cards/TodayJournalCard";
import { DaylogCard } from "./cards/DaylogCard";
import { RecentNotesCard, useRecentTypeOptions } from "./cards/RecentNotesCard";
import { noteCommands, useNotesCommands } from "./commands";
import { registerNotesBridge } from "./data/bridge";
import { noteTypes } from "./types";
import { DAILY, NOTE, TEMPLATE } from "./domain/types";

registerNotesBridge();
import { PeopleCard, peopleTitle, usePeopleTypeOptions } from "./cards/PeopleCard";
import { MentionsCard, useMentionsTitle } from "./cards/MentionsCard";
import { UnresolvedCard } from "./cards/UnresolvedCard";
import { CaptureCard } from "./cards/CaptureCard";
import { OnThisDayCard } from "./cards/OnThisDayCard";
import { StreakCard } from "./cards/StreakCard";
import { WritingStatsCard } from "./cards/WritingStatsCard";
import { useAnyDocumentOptions, useFolderOptions, useNoteOptions, useTagOptions } from "./data/options";
import { PinnedNoteCard, usePinnedNoteTitle } from "./cards/PinnedNoteCard";
import { FolderCard, folderTitle } from "./cards/FolderCard";
import { TagCard, tagTitle } from "./cards/TagCard";
import { RandomNoteCard, randomTitle, useRandomTypeOptions } from "./cards/RandomNoteCard";
import { SavedSearchCard, searchTitle } from "./cards/SavedSearchCard";

const APP_ID = "notes";

/** Type defs with their icons attached (icons live here so src/types.ts stays UI-free for tests). */
const ICONS = { [DAILY]: CalendarDays, [NOTE]: FileText, [TEMPLATE]: LayoutTemplate, [PRIVATE_SETTINGS_TYPE]: Lock } as const;
const typesWithIcons = noteTypes.map((t) => ({ ...t, icon: ICONS[t.id as keyof typeof ICONS] }));

const offsetKnob = { kind: "number" as const, label: "Day offset", default: 0, min: -365, max: 0 };
const offsetTitle = (base: string) => (s: CardSettings) => {
  const o = Number(s.offset ?? 0);
  return o === 0 ? base : o === -1 ? `${base} · yesterday` : `${base} · ${formatHuman(addDays(todayStr(), o))}`;
};

/** Notes App (ADR 0018/0019): owns the note, daily and template Document types; the Journal lives in the Vault. */
export const notesApp: AppManifest = {
  id: APP_ID,
  title: "Notes",
  icon: NotebookPen,
  color: "var(--chart-green)",
  types: typesWithIcons,
  screens: [{ id: "notes.journal", title: "Journal", path: "journal", icon: NotebookPen, component: JournalScreen, workspace: VAULT_WORKSPACE }],
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
      instanceTitle: (s) => { const d = s.type ? documentType(String(s.type)) : undefined; return d ? `Recent ${d.label.toLowerCase()}` : ""; },
      tagFilterable: true,
    },
    {
      id: "notes.people",
      title: "People I've seen",
      description: "Who your recent daily notes mention most",
      component: PeopleCard,
      defaultSize: { w: 3, h: 5 },
      minSize: { w: 2, h: 3 },
      settings: {
        days: { kind: "number", label: "Last N days", default: 30, min: 1, max: 365 },
        count: { kind: "number", label: "How many", default: 10, min: 1, max: 50 },
        type: { kind: "entity", label: "Type", useOptions: usePeopleTypeOptions, anyLabel: "Any type", default: "person" },
      },
      instanceTitle: peopleTitle,
    },
    {
      id: "notes.mentions",
      title: "Mentions of…",
      description: "Every Document that links to one Document, newest first",
      component: MentionsCard,
      defaultSize: { w: 3, h: 6 },
      minSize: { w: 2, h: 3 },
      settings: {
        target: { kind: "entity", label: "Document", required: true, useOptions: useAnyDocumentOptions },
        count: { kind: "number", label: "How many", default: 10, min: 1, max: 50 },
      },
      instanceTitle: useMentionsTitle,
    },
    {
      id: "notes.unresolved",
      title: "Unresolved links",
      description: "[[Links]] that point at nothing yet — create the note in one click",
      component: UnresolvedCard,
      defaultSize: { w: 3, h: 5 },
      minSize: { w: 2, h: 3 },
      settings: {
        count: { kind: "number", label: "How many", default: 15, min: 1, max: 100 },
        sort: { kind: "select", label: "Sort", default: "count", options: [{ value: "count", label: "Most mentioned" }, { value: "name", label: "Name" }] },
      },
      instanceTitle: (s) => (s.sort === "name" ? "Unresolved links · A–Z" : ""),
    },
    {
      id: "notes.capture",
      title: "Quick capture",
      description: "One line into today's journal, Enter to send",
      component: CaptureCard,
      defaultSize: { w: 3, h: 2 },
      minSize: { w: 2, h: 2 },
      settings: {
        prefix: { kind: "select", label: "Prefix", default: "timestamp", options: [{ value: "timestamp", label: "Timestamp" }, { value: "bullet", label: "Bullet" }] },
      },
      instanceTitle: (s) => (s.prefix === "bullet" ? "Quick capture · bullet" : ""),
    },
    {
      id: "notes.on-this-day",
      title: "On this day",
      description: "Journal entries from the same day in earlier years",
      component: OnThisDayCard,
      defaultSize: { w: 4, h: 6 },
      minSize: { w: 2, h: 3 },
      settings: {
        years: {
          kind: "select",
          label: "Years",
          default: "all",
          options: [
            { value: "all", label: "All previous years" },
            { value: "last", label: "Last year only" },
          ],
        },
        alsoWeeks: {
          kind: "select",
          label: "Also 1 and 4 weeks ago",
          default: "no",
          options: [
            { value: "no", label: "No" },
            { value: "yes", label: "Yes" },
          ],
        },
        dayOffset: { kind: "number", label: "Day offset", default: 0, min: -365, max: 0 },
      },
      instanceTitle: (s) => {
        const o = Number(s.dayOffset ?? 0);
        return o === 0 ? "On this day" : `On this day · ${formatHuman(addDays(todayStr(), o))}`;
      },
    },
    {
      id: "notes.streak",
      title: "Journal streak",
      description: "Days you actually wrote — current and longest run",
      component: StreakCard,
      defaultSize: { w: 3, h: 4 },
      minSize: { w: 2, h: 2 },
      settings: { days: { kind: "number", label: "Days", default: 30, min: 7, max: 120 } },
      instanceTitle: (s) => `Journal streak · ${Number(s.days ?? 30)}d`,
    },
    {
      id: "notes.writing",
      title: "Writing stats",
      description: "Words this week and month, entries per month",
      component: WritingStatsCard,
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 2, h: 3 },
      settings: { months: { kind: "number", label: "Months", default: 6, min: 1, max: 24 } },
      instanceTitle: (s) => `Writing stats · ${Number(s.months ?? 6)}mo`,
    },
    {
      id: "notes.pinned",
      title: "Pinned note",
      description: "One note, always in view",
      component: PinnedNoteCard,
      defaultSize: { w: 4, h: 6 },
      minSize: { w: 2, h: 3 },
      settings: {
        note: { kind: "entity", label: "Note", required: true, useOptions: useNoteOptions },
        mode: { kind: "select", label: "Show", default: "read", options: [{ value: "read", label: "Rendered" }, { value: "excerpt", label: "Plain excerpt" }] },
      },
      instanceTitle: usePinnedNoteTitle,
    },
    {
      id: "notes.folder",
      title: "Folder",
      description: "The notes of one folder, newest first",
      component: FolderCard,
      defaultSize: { w: 3, h: 6 },
      minSize: { w: 2, h: 3 },
      settings: {
        folder: { kind: "entity", label: "Folder", required: true, useOptions: useFolderOptions },
        recursive: { kind: "select", label: "Include subfolders", default: "yes", options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
        count: { kind: "number", label: "How many", default: 12, min: 1, max: 100 },
      },
      instanceTitle: folderTitle,
    },
    {
      id: "notes.tag",
      title: "Tag",
      description: "Every note carrying one tag, with the text around it",
      component: TagCard,
      defaultSize: { w: 3, h: 6 },
      minSize: { w: 2, h: 3 },
      settings: {
        tag: { kind: "entity", label: "Tag", required: true, useOptions: useTagOptions },
        count: { kind: "number", label: "How many", default: 12, min: 1, max: 100 },
      },
      instanceTitle: tagTitle,
    },
    {
      id: "notes.random",
      title: "Random note",
      description: "Resurface a note at random — reroll for another",
      component: RandomNoteCard,
      defaultSize: { w: 3, h: 5 },
      minSize: { w: 2, h: 3 },
      settings: {
        type: { kind: "entity", label: "Type", useOptions: useRandomTypeOptions, anyLabel: "Any type" },
        folder: { kind: "entity", label: "Folder", useOptions: useFolderOptions, anyLabel: "Anywhere" },
      },
      instanceTitle: randomTitle,
    },
    {
      id: "notes.search",
      title: "Saved search",
      description: "A full-text search over titles, aliases and bodies, kept on screen",
      component: SavedSearchCard,
      defaultSize: { w: 3, h: 6 },
      minSize: { w: 2, h: 3 },
      settings: {
        query: { kind: "text", label: "Query", default: "", placeholder: "Search notes…" },
        count: { kind: "number", label: "How many", default: 12, min: 1, max: 100 },
        type: { kind: "entity", label: "Type", useOptions: useRandomTypeOptions, anyLabel: "Any type" },
      },
      instanceTitle: searchTitle,
    },
  ],
  commands: noteCommands,
  useCommands: useNotesCommands,
  /** Once per launch: re-key a Private settings row saved under the old, unsyncable id (ADR 0038). */
  useBackground: () => {
    useEffect(() => void repairPrivateSettings().catch(() => {}), []);
  },
};

export { NOTE, DAILY, TEMPLATE, type Note } from "./domain/types";
export { noteTypes } from "./types";
