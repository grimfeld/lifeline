/**
 * The **Guide** (CONTEXT.md, ADR 0089): Lifeline's manual, one page per thing
 * the user opens — a Module, a Surface, a Core concept — never per App. The
 * shell renders it at `/guide`; the MCP server hands it to Claude.
 *
 * `apps` names the Apps a page answers for: every Command and Card of each must
 * be named on it (shell/src/guide/guide.test.ts). How to write a page:
 * packages/guide/AUTHORING.md.
 *
 * This is the index alone, which the always-mounted palette lists. The pages'
 * Markdown is `@lifeline/guide/pages`, loaded with the Guide itself.
 */
export type GuideKind = "home" | "module" | "surface" | "core";

export interface GuidePage {
  slug: string;
  /** The page's first `# ` heading, word for word (checked in index.test.ts). */
  title: string;
  kind: GuideKind;
  /** The Module this page explains, by id. */
  module?: string;
  /** The Surface this page explains, by id. */
  surface?: string;
  apps: string[];
}

type Entry = Omit<GuidePage, "apps"> & { apps?: string[] };

const ENTRIES: Entry[] = [
  { slug: "index", title: "Getting around", kind: "home" },
  { slug: "house", title: "House", kind: "module", module: "house", apps: ["chores", "pantry", "shopping"] },
  { slug: "projects", title: "Projects", kind: "module", module: "tasks", apps: ["tasks", "projects"] },
  { slug: "culture", title: "Culture", kind: "module", module: "culture", apps: ["library", "cinema", "discotheque", "arcade", "museum"] },
  { slug: "money", title: "Money", kind: "module", module: "money", apps: ["ledger", "pocket", "prices"] },
  { slug: "journal", title: "Journal", kind: "module", module: "journal", apps: ["notes"] },
  { slug: "notes", title: "Notes", kind: "module", module: "notes", apps: ["commonplace", "sources"] },
  { slug: "research", title: "Research", kind: "module", module: "research", apps: ["writer"] },
  { slug: "manuscript", title: "Manuscript", kind: "module", module: "manuscript", apps: ["manuscript"] },
  { slug: "thoughts", title: "Thoughts", kind: "module", module: "thoughts", apps: ["thoughts"] },
  { slug: "progress", title: "Progress", kind: "module", module: "progress", apps: ["stats", "lifelevel", "workout", "mood", "swearjar"] },
  { slug: "knowledge", title: "Knowledge", kind: "module", module: "languages", apps: ["languages"] },
  // The Calendar App has no Module: its Events live on the Calendar Surface.
  { slug: "calendar", title: "Calendar", kind: "surface", surface: "calendar", apps: ["calendar"] },
  { slug: "map", title: "Map", kind: "surface", surface: "map" },
  { slug: "graph", title: "Graph", kind: "surface", surface: "graph" },
  { slug: "documents", title: "Documents", kind: "core" },
  { slug: "workspaces", title: "Workspaces", kind: "core" },
  { slug: "capture", title: "Capture", kind: "core" },
  { slug: "bases", title: "Bases", kind: "core" },
  // Core's own Cards and Commands (the hub) are Screens' business.
  { slug: "screens", title: "Screens and Cards", kind: "core", apps: ["hub"] },
  { slug: "peek", title: "Peek and selection", kind: "core" },
  { slug: "links", title: "Links", kind: "core" },
  { slug: "vault", title: "The Vault", kind: "core" },
  { slug: "phone", title: "Using Lifeline on a phone", kind: "core" },
  { slug: "settings", title: "Settings", kind: "core" },
  { slug: "macros", title: "Macros", kind: "core" },
  { slug: "keys", title: "Keys", kind: "core" },
  { slug: "connector", title: "Claude", kind: "core" },
  { slug: "guide", title: "About the Guide", kind: "core" },
];

/** Every page, in the order the Guide's home lists them. */
export const GUIDE_PAGES: GuidePage[] = ENTRIES.map((e) => ({ ...e, apps: e.apps ?? [] }));

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
