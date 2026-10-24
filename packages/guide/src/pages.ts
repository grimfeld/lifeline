// The shell and the MCP server compile this file under their own tsconfig, which does not
// include raw.d.ts: the reference carries the `?raw` declaration to them.
// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- an import cannot load a .d.ts
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
import macros from "../pages/macros.md?raw";
import keys from "../pages/keys.md?raw";
import connector from "../pages/connector.md?raw";

/**
 * The Guide's pages as Markdown, by slug (`@lifeline/guide/pages`). Apart from
 * the index (`@lifeline/guide`) so a first load never carries the manual: the
 * shell reaches this only from the Guide's own lazy page, the MCP server eagerly.
 * Links to other pages are their file names (`calendar.md`).
 */
const BODIES: Record<string, string> = {
  index,
  guide,
  house,
  projects,
  culture,
  money,
  journal,
  notes,
  research,
  manuscript,
  thoughts,
  progress,
  knowledge,
  calendar,
  map,
  graph,
  documents,
  workspaces,
  capture,
  bases,
  screens,
  peek,
  links,
  vault,
  phone,
  settings,
  macros,
  keys,
  connector,
};

/** A page's Markdown, by slug. */
export function guideBody(slug: string): string | undefined {
  return Object.hasOwn(BODIES, slug) ? BODIES[slug] : undefined;
}
