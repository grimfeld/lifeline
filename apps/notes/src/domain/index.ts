import type { LinkTarget } from "@lifeline/core";
import type { Note } from "./types";
import { extractLinks, extractTags, normalizeName, splitFrontmatter, type Properties, type WikiLink } from "./markdown";
import { normalizeFolder, notePath } from "./folders";

/** What a wikilink points at (ADR 0009): a note, an App entity, or nothing yet. */
export type LinkRef =
  | { kind: "note"; noteId: string }
  | { kind: "app"; appId: string; itemId: string; href?: string; color?: string }
  | { kind: "unresolved"; name: string };

export interface ResolvedLink {
  link: WikiLink;
  ref: LinkRef;
}

export interface Backlink {
  noteId: string;
  /** Text around the mention. */
  context: string;
}

export interface NoteIndex {
  notes: Note[];
  byId: Map<string, Note>;
  /** Resolve a name as written in [[…]]. */
  resolve(name: string): LinkRef;
  linksFrom(noteId: string): ResolvedLink[];
  backlinksTo(ref: { kind: "note"; noteId: string } | { kind: "app"; appId: string; itemId: string }): Backlink[];
  /** Names that resolve to nothing, with the notes mentioning them. */
  unresolved: Map<string, string[]>;
  tags: Map<string, string[]>;
  properties(noteId: string): Properties;
  /** Titles + aliases of every note and App target, for autocomplete. */
  names(): { name: string; ref: LinkRef; subtitle?: string }[];
}

function aliasesOf(props: Properties): string[] {
  const a = props.aliases;
  return Array.isArray(a) ? a : typeof a === "string" && a ? [a] : [];
}

function contextAround(text: string, from: number, to: number, radius = 60): string {
  const start = Math.max(0, text.lastIndexOf("\n", from) + 1, from - radius);
  const endNl = text.indexOf("\n", to);
  const end = Math.min(text.length, endNl === -1 ? text.length : endNl, to + radius);
  return (start > 0 && text[start - 1] !== "\n" ? "…" : "") + text.slice(start, end).trim() + (end < text.length && text[end] !== "\n" ? "…" : "");
}

/**
 * Derive everything from the notes' text (plus the Apps' Linkable targets).
 * Precedence (ADR 0009/0013): exact `Folder/Name` path → note title (unique,
 * else the shortest path) → note alias → App entity name → App alias → unresolved.
 * Pure; rebuild whenever notes or targets change.
 */
export function buildIndex(notes: Note[], targets: (LinkTarget & { color?: string })[] = []): NoteIndex {
  const byId = new Map(notes.map((n) => [n.id, n]));
  const props = new Map<string, Properties>();
  const byPath = new Map<string, string>();
  const byTitle = new Map<string, string>();
  const byAlias = new Map<string, string>();
  const depth = (n: Note) => (n.folder ? n.folder.split("/").length : 0);
  for (const n of notes) {
    const p = splitFrontmatter(n.body).properties;
    props.set(n.id, p);
    byPath.set(normalizeName(notePath(n)), n.id);
    const key = normalizeName(n.title);
    const cur = byTitle.get(key);
    // Ambiguous titles: the shallowest path wins (Obsidian's rule); ties keep the first.
    if (!cur || depth(n) < depth(byId.get(cur)!)) byTitle.set(key, n.id);
    for (const a of aliasesOf(p)) {
      const k = normalizeName(a);
      if (!byAlias.has(k)) byAlias.set(k, n.id);
    }
  }
  const appByName = new Map<string, LinkRef>();
  const appByAlias = new Map<string, LinkRef>();
  for (const t of targets) {
    const ref: LinkRef = { kind: "app", appId: t.appId, itemId: t.itemId, href: t.href, color: t.color };
    const k = normalizeName(t.name);
    if (!appByName.has(k)) appByName.set(k, ref);
    for (const a of t.aliases ?? []) {
      const ak = normalizeName(a);
      if (!appByAlias.has(ak)) appByAlias.set(ak, ref);
    }
  }

  function resolve(name: string): LinkRef {
    const k = normalizeName(name);
    if (k.includes("/")) {
      const byP = byPath.get(normalizeName(normalizeFolder(k)));
      if (byP) return { kind: "note", noteId: byP };
    }
    const t = byTitle.get(k);
    if (t) return { kind: "note", noteId: t };
    const a = byAlias.get(k);
    if (a) return { kind: "note", noteId: a };
    return appByName.get(k) ?? appByAlias.get(k) ?? { kind: "unresolved", name: name.trim() };
  }

  const linksFromMap = new Map<string, ResolvedLink[]>();
  const backlinks = new Map<string, Backlink[]>();
  const unresolved = new Map<string, string[]>();
  const tags = new Map<string, string[]>();
  const refKey = (r: LinkRef) =>
    r.kind === "note" ? `note:${r.noteId}` : r.kind === "app" ? `app:${r.appId}/${r.itemId}` : `unresolved:${normalizeName(r.name)}`;

  for (const n of notes) {
    const links = extractLinks(n.body).map((link) => ({ link, ref: resolve(link.name) }));
    linksFromMap.set(n.id, links);
    const seenTargets = new Set<string>();
    for (const { link, ref } of links) {
      const key = refKey(ref);
      if (ref.kind === "unresolved") {
        const k = normalizeName(ref.name);
        const list = unresolved.get(k) ?? [];
        if (!list.includes(n.id)) list.push(n.id);
        unresolved.set(k, list);
        continue;
      }
      if (ref.kind === "note" && ref.noteId === n.id) continue; // self-link
      const list = backlinks.get(key) ?? [];
      list.push({ noteId: n.id, context: contextAround(n.body, link.from, link.to) });
      backlinks.set(key, list);
      seenTargets.add(key);
    }
    for (const t of extractTags(n.body)) {
      const list = tags.get(t) ?? [];
      list.push(n.id);
      tags.set(t, list);
    }
  }

  return {
    notes,
    byId,
    resolve,
    linksFrom: (id) => linksFromMap.get(id) ?? [],
    backlinksTo: (ref) => backlinks.get(refKey(ref)) ?? [],
    unresolved,
    tags,
    properties: (id) => props.get(id) ?? {},
    names: () => {
      const out: { name: string; ref: LinkRef; subtitle?: string }[] = [];
      const titleCount = new Map<string, number>();
      for (const n of notes) titleCount.set(normalizeName(n.title), (titleCount.get(normalizeName(n.title)) ?? 0) + 1);
      for (const n of notes) {
        const ambiguous = (titleCount.get(normalizeName(n.title)) ?? 0) > 1;
        out.push({ name: ambiguous ? notePath(n) : n.title, ref: { kind: "note", noteId: n.id }, subtitle: n.folder || n.type });
        for (const a of aliasesOf(props.get(n.id) ?? {})) out.push({ name: a, ref: { kind: "note", noteId: n.id }, subtitle: `→ ${n.title}` });
      }
      for (const t of targets) {
        const ref: LinkRef = { kind: "app", appId: t.appId, itemId: t.itemId, href: t.href, color: t.color };
        out.push({ name: t.name, ref, subtitle: t.subtitle ?? t.appId });
      }
      return out;
    },
  };
}
