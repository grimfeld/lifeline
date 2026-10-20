/// <reference path="./raw.d.ts" />
import index from "../pages/index.md?raw";
import guide from "../pages/guide.md?raw";
import house from "../pages/house.md?raw";
import projects from "../pages/projects.md?raw";
import culture from "../pages/culture.md?raw";
import money from "../pages/money.md?raw";
import journal from "../pages/journal.md?raw";
import notes from "../pages/notes.md?raw";
import research from "../pages/research.md?raw";
import manuscript from "../pages/manuscript.md?raw";
import thoughts from "../pages/thoughts.md?raw";
import progress from "../pages/progress.md?raw";
import knowledge from "../pages/knowledge.md?raw";
import calendar from "../pages/calendar.md?raw";
import map from "../pages/map.md?raw";
import graph from "../pages/graph.md?raw";
import documents from "../pages/documents.md?raw";
import workspaces from "../pages/workspaces.md?raw";
import capture from "../pages/capture.md?raw";
import bases from "../pages/bases.md?raw";
import screens from "../pages/screens.md?raw";
import peek from "../pages/peek.md?raw";
import links from "../pages/links.md?raw";
import vault from "../pages/vault.md?raw";
import phone from "../pages/phone.md?raw";
import settings from "../pages/settings.md?raw";
import connector from "../pages/connector.md?raw";

/**
 * The **Guide** (CONTEXT.md, ADR 0089): Lifeline's manual, one page per thing
 * the user opens — a Module, a Surface, a Core concept — never per App. The
 * shell renders it at `/guide`; the MCP server hands it to Claude.
 *
 * `apps` names the Apps a page answers for: every Command and Card of each must
 * be named on it (shell/src/guide/guide.test.ts). How to write a page:
 * packages/guide/AUTHORING.md.
 */
export type GuideKind = "home" | "module" | "surface" | "core";

export interface GuidePage {
  slug: string;
  title: string;
  kind: GuideKind;
  /** The Module this page explains, by id. */
  module?: string;
  /** The Surface this page explains, by id. */
  surface?: string;
  apps: string[];
  /** Markdown; links to other pages are their file names (`calendar.md`). */
  body: string;
}

type Entry = Omit<GuidePage, "title" | "apps"> & { apps?: string[] };

const ENTRIES: Entry[] = [
  { slug: "index", kind: "home", body: index },
  { slug: "house", kind: "module", module: "house", apps: ["chores", "pantry", "shopping"], body: house },
  { slug: "projects", kind: "module", module: "tasks", apps: ["tasks", "projects"], body: projects },
  { slug: "culture", kind: "module", module: "culture", apps: ["library", "cinema", "discotheque", "arcade", "museum"], body: culture },
  { slug: "money", kind: "module", module: "money", apps: ["ledger", "pocket", "prices"], body: money },
  { slug: "journal", kind: "module", module: "journal", apps: ["notes"], body: journal },
  { slug: "notes", kind: "module", module: "notes", apps: ["commonplace", "sources"], body: notes },
  { slug: "research", kind: "module", module: "research", apps: ["writer"], body: research },
  { slug: "manuscript", kind: "module", module: "manuscript", apps: ["manuscript"], body: manuscript },
  { slug: "thoughts", kind: "module", module: "thoughts", apps: ["thoughts"], body: thoughts },
  { slug: "progress", kind: "module", module: "progress", apps: ["stats", "lifelevel", "workout", "mood", "swearjar"], body: progress },
  { slug: "knowledge", kind: "module", module: "languages", apps: ["languages"], body: knowledge },
  // The Calendar App has no Module: its Events live on the Calendar Surface.
  { slug: "calendar", kind: "surface", surface: "calendar", apps: ["calendar"], body: calendar },
  { slug: "map", kind: "surface", surface: "map", body: map },
  { slug: "graph", kind: "surface", surface: "graph", body: graph },
  { slug: "documents", kind: "core", body: documents },
  { slug: "workspaces", kind: "core", body: workspaces },
  { slug: "capture", kind: "core", body: capture },
  { slug: "bases", kind: "core", body: bases },
  // Core's own Cards and Commands (the hub) are Screens' business.
  { slug: "screens", kind: "core", apps: ["hub"], body: screens },
  { slug: "peek", kind: "core", body: peek },
  { slug: "links", kind: "core", body: links },
  { slug: "vault", kind: "core", body: vault },
  { slug: "phone", kind: "core", body: phone },
  { slug: "settings", kind: "core", body: settings },
  { slug: "connector", kind: "core", body: connector },
  { slug: "guide", kind: "core", body: guide },
];

/** A page's title: its first `# ` heading. */
function titleOf(body: string, slug: string): string {
  return /^# (.+)$/m.exec(body)?.[1].trim() ?? slug;
}

/** Every page, in the order the Guide's home lists them. */
export const GUIDE_PAGES: GuidePage[] = ENTRIES.map((e) => ({ ...e, apps: e.apps ?? [], title: titleOf(e.body, e.slug) }));

export function guidePage(slug: string | undefined): GuidePage | undefined {
  return GUIDE_PAGES.find((p) => p.slug === (slug || "index"));
}

/** The page that explains a Module, by Module id. */
export function guidePageOfModule(moduleId: string | undefined): GuidePage | undefined {
  return moduleId ? GUIDE_PAGES.find((p) => p.module === moduleId) : undefined;
}

/** The page that explains a Surface, by Surface id. */
export function guidePageOfSurface(surfaceId: string | undefined): GuidePage | undefined {
  return surfaceId ? GUIDE_PAGES.find((p) => p.surface === surfaceId) : undefined;
}

/** The page a link inside a page body names (`calendar.md`, `./calendar.md`), or undefined if it names none. */
export function guideLink(href: string): string | undefined {
  const m = /^(?:\.\/)?([a-z0-9-]+)\.md$/.exec(href);
  return m && guidePage(m[1]) ? m[1] : undefined;
}
