import { useMemo } from "react";
import { extractLinks, isImageEmbed, normalizeName, type WikiLink } from "../markdown";
import { docPath, normalizeFolder } from "../folders";
import { aliasesOf, displayTitle, singularOf, type Document, type DocumentTypeDef } from "./types";
import { useAllDocuments } from "./store";
import { usePrivateLockedRefs, type PrivateLockedRefs } from "../private";

const NO_LOCKED: PrivateLockedRefs = { names: new Set(), ids: new Set() };
import { useDocumentTypes } from "./registry";
import { docHref } from "./href";

/** What a wikilink points at (ADR 0018/0019): a Document, or nothing yet. */
/** A link's target: a Document, nothing yet, or a Document behind the locked Private folder (ADR 0038 — a lock, never a hole). */
export type LinkRef = { kind: "doc"; id: string; type: string } | { kind: "unresolved"; name: string } | { kind: "locked"; name: string };

export interface ResolvedLink {
  link: WikiLink;
  ref: LinkRef;
}

export interface Backlink {
  /** The referring Document. */
  sourceId: string;
  /** Text around the mention ("" for a Link field). */
  context: string;
  /** Key of the Link field that holds the reference, for field-based backlinks. */
  field?: string;
}

export interface LinkName {
  name: string;
  /** What to write in `[[…]]` to reach the target unambiguously: its title, or `Folder/Title` when the title is shared. */
  canonical: string;
  ref: LinkRef;
  subtitle?: string;
  /** Type id of the target (for badges in the completer). */
  type: string;
}

export interface LinkIndex {
  docs: Document[];
  /**
   * The Documents whose links count for anyone else: `docs` less the internal
   * types' (see `originatesLinks`). Backlinks, Ghosts and tags are already
   * derived from these; the Unlinked-mention scanner walks them too.
   */
  linkSources: Document[];
  byId: Map<string, Document>;
  /** Resolve a name as written in [[…]] (with an optional `type:` prefix). The first target when a name expands to several. */
  resolve(name: string): LinkRef;
  /** Every target a written name stands for (ADR 0032) — several when a type's expander splits it. */
  resolveAll(name: string): LinkRef[];
  linksFrom(docId: string): ResolvedLink[];
  backlinksTo(docId: string): Backlink[];
  /** Normalised unresolved names → ids of the Documents mentioning them. */
  unresolved: Map<string, string[]>;
  /** Tag → ids of the Documents carrying it. */
  tags: Map<string, string[]>;
  /** Titles + aliases of every linkable Document, for autocomplete. */
  names(): LinkName[];
  /** The subset of `names()` that may be offered as Unlinked mentions (types opt out with `linkable.mentions: false`). */
  mentionNames(): LinkName[];
}

/** The line around a span, clipped to `radius` chars each side: backlink and mention context. */
export function contextAround(text: string, from: number, to: number, radius = 60): string {
  const start = Math.max(0, text.lastIndexOf("\n", from) + 1, from - radius);
  const endNl = text.indexOf("\n", to);
  const end = Math.min(text.length, endNl === -1 ? text.length : endNl, to + radius);
  return (start > 0 && text[start - 1] !== "\n" ? "…" : "") + text.slice(start, end).trim() + (end < text.length && text[end] !== "\n" ? "…" : "");
}

/** Whether a type's Documents are wikilink targets at all (internal types never are). */
export function isLinkable(def: DocumentTypeDef | undefined): boolean {
  if (!def) return false;
  if (def.internal) return false;
  return !!def.linkable;
}

/**
 * Whether a Document's own links are anyone else's business. An internal type's
 * Documents exist only in service of another (CONTEXT.md) — a Writing's
 * Versions are snapshots of its prose, a Chore's completions hang off the Chore
 * — so what they say is the owner's, counted once there already. Counting it
 * again under their own names is how a note ends up with the same Unlinked
 * mention from a Writing and each of its twelve Versions. They are targets of
 * nothing (`isLinkable`) and now sources of nothing: a Version is only ever
 * seen from the Writing it belongs to.
 */
function originatesLinks(def: DocumentTypeDef | undefined): boolean {
  return !def?.internal;
}

/**
 * Derive every link relation from the Documents (ADR 0018): wikilinks in
 * bodies and Link fields. Precedence (CONTEXT.md "Wikilink"): an exact
 * `Folder/Name` path → a unique title across linkable types (ties: the
 * shallowest path, then the first) → an alias → unresolved. `[[type:Name]]`
 * restricts to one type (id, label or plural, case-insensitive). Pure;
 * rebuild whenever Documents or types change.
 */
export function buildLinkIndex(docs: Document[], types: DocumentTypeDef[], locked: PrivateLockedRefs = NO_LOCKED): LinkIndex {
  const defs = new Map(types.map((t) => [t.id, t]));
  const typeByWord = new Map<string, string>();
  for (const t of types) {
    typeByWord.set(normalizeName(t.id), t.id);
    typeByWord.set(normalizeName(t.label), t.id);
    typeByWord.set(normalizeName(singularOf(t)), t.id);
  }
  const byId = new Map(docs.map((d) => [d.id, d]));
  const targets = docs.filter((d) => isLinkable(defs.get(d.type)));
  const depth = (d: Document) => (d.folder ? d.folder.split("/").length : 0);
  const titleOf = (d: Document) => displayTitle(d, defs.get(d.type));

  const byPath = new Map<string, string>();
  const byTitle = new Map<string, string>();
  const byAlias = new Map<string, string>();
  const byTypeTitle = new Map<string, string>();
  const byTypeAlias = new Map<string, string>();
  for (const d of targets) {
    const title = titleOf(d);
    byPath.set(normalizeName(docPath({ folder: d.folder, title })), d.id);
    const key = normalizeName(title);
    const cur = byTitle.get(key);
    if (!cur || depth(d) < depth(byId.get(cur)!)) byTitle.set(key, d.id);
    const tk = `${d.type}:${key}`;
    if (!byTypeTitle.has(tk)) byTypeTitle.set(tk, d.id);
    for (const a of aliasesOf(d, defs.get(d.type))) {
      const k = normalizeName(a);
      if (!byAlias.has(k)) byAlias.set(k, d.id);
      const tak = `${d.type}:${k}`;
      if (!byTypeAlias.has(tak)) byTypeAlias.set(tak, d.id);
    }
  }

  const ref = (id: string): LinkRef => ({ kind: "doc", id, type: byId.get(id)?.type ?? "" });
  const expanders = types.filter((t) => typeof t.linkable === "object" && t.linkable.expand).map((t) => ({ type: t.id, expand: (t.linkable as { expand: (n: string) => string[] | null }).expand }));

  /**
   * Every target a written name stands for (ADR 0032): a type's expander may
   * turn one name into several of its titles (a scripture range). Titles it
   * names that do not exist yet come back unresolved under their canonical
   * name, so Ghost nodes and on-demand creation see the real titles.
   */
  function resolveAll(name: string): LinkRef[] {
    for (const { type, expand } of expanders) {
      let titles: string[] | null = null;
      try {
        titles = expand(name);
      } catch {
        titles = null;
      }
      if (!titles || titles.length === 0) continue;
      return titles.map((title) => {
        const hit = byTypeTitle.get(`${type}:${normalizeName(title)}`);
        return hit ? ref(hit) : { kind: "unresolved" as const, name: title };
      });
    }
    return [resolve(name)];
  }

  function resolve(name: string): LinkRef {
    let k = normalizeName(name);
    // `type:Name` prefix
    const colon = k.indexOf(":");
    if (colon > 0) {
      const typeId = typeByWord.get(k.slice(0, colon).trim());
      if (typeId) {
        const rest = k.slice(colon + 1).trim();
        const hit = byTypeTitle.get(`${typeId}:${rest}`) ?? byTypeAlias.get(`${typeId}:${rest}`);
        if (hit) return ref(hit);
        k = rest;
      }
    }
    if (k.includes("/")) {
      const byP = byPath.get(normalizeName(normalizeFolder(k)));
      if (byP) return ref(byP);
    }
    const t = byTitle.get(k);
    if (t) return ref(t);
    const a = byAlias.get(k);
    if (a) return ref(a);
    if (locked.names.has(k)) return { kind: "locked", name: name.trim() };
    return { kind: "unresolved", name: name.trim() };
  }

  const linksFromMap = new Map<string, ResolvedLink[]>();
  const backlinks = new Map<string, Backlink[]>();
  const unresolved = new Map<string, string[]>();
  const tags = new Map<string, string[]>();

  for (const d of docs) {
    const def = defs.get(d.type);
    const body = typeof d.body === "string" ? d.body : "";
    // An image embed points at an Attachment (ADR 0037), not a Document: never unresolved, never a Ghost.
    const links = body ? extractLinks(body).filter((l) => !isImageEmbed(l)).flatMap((link) => resolveAll(link.name).map((r) => ({ link, ref: r }))) : [];
    // Resolved for the Document's own panel — a Version's snapshot still renders
    // its wikilinks — but nothing below this line, which is what others see.
    linksFromMap.set(d.id, links);
    if (!originatesLinks(def)) continue;
    for (const { link, ref: r } of links) {
      if (r.kind === "locked") continue; // behind the gate: no backlink, no Ghost
      if (r.kind === "unresolved") {
        const k = normalizeName(r.name);
        const list = unresolved.get(k) ?? [];
        if (!list.includes(d.id)) list.push(d.id);
        unresolved.set(k, list);
        continue;
      }
      if (r.id === d.id) continue; // self-link
      const list = backlinks.get(r.id) ?? [];
      list.push({ sourceId: d.id, context: contextAround(body, link.from, link.to) });
      backlinks.set(r.id, list);
    }
    // Link fields (ADR 0019): a stored id is a reference too.
    for (const f of def?.fields ?? []) {
      if (f.kind !== "link") continue;
      const v = d[f.key];
      const ids = Array.isArray(v) ? v : typeof v === "string" && v ? [v] : [];
      for (const id of ids) {
        if (typeof id !== "string" || id === d.id || !byId.has(id)) continue;
        const list = backlinks.get(id) ?? [];
        list.push({ sourceId: d.id, context: "", field: f.key });
        backlinks.set(id, list);
      }
    }
    for (const t of d.tags ?? []) {
      const list = tags.get(t) ?? [];
      list.push(d.id);
      tags.set(t, list);
    }
  }

  return {
    docs,
    linkSources: docs.filter((d) => originatesLinks(defs.get(d.type))),
    byId,
    resolve,
    resolveAll,
    linksFrom: (id) => linksFromMap.get(id) ?? [],
    backlinksTo: (id) => backlinks.get(id) ?? [],
    unresolved,
    tags,
    names: () => names(targets, "canonical"),
    mentionNames: () => names(targets.filter((d) => mentionable(defs.get(d.type))), "title"),
  };

  /** Title + alias entries; the completer shows the canonical (path) form, the mention scanner needs the bare title. */
  function names(of: Document[], show: "canonical" | "title"): LinkName[] {
    const out: LinkName[] = [];
    const titleCount = new Map<string, number>();
    for (const d of targets) {
      const k = normalizeName(titleOf(d));
      titleCount.set(k, (titleCount.get(k) ?? 0) + 1);
    }
    for (const d of of) {
      const def = defs.get(d.type);
      const title = titleOf(d);
      const ambiguous = (titleCount.get(normalizeName(title)) ?? 0) > 1;
      const canonical = ambiguous ? docPath({ folder: d.folder, title }) : title;
      const sub = typeof def?.linkable === "object" ? def.linkable.subtitle?.(d) : undefined;
      out.push({ name: show === "title" ? title : canonical, canonical, ref: ref(d.id), subtitle: sub ?? (d.folder || (def && singularOf(def))), type: d.type });
      for (const a of aliasesOf(d, def)) out.push({ name: a, canonical, ref: ref(d.id), subtitle: `→ ${title}`, type: d.type });
    }
    return out;
  }
}

/** Whether a type's Documents may be offered as Unlinked mentions (CONTEXT.md): linkable, and not opted out. */
function mentionable(def: DocumentTypeDef | undefined): boolean {
  if (!isLinkable(def)) return false;
  const l = def!.linkable;
  return !(typeof l === "object" && l.mentions === false);
}

let last: { docs: Document[]; types: DocumentTypeDef[]; locked: PrivateLockedRefs; index: LinkIndex } | null = null;

/** The index for one (docs, types, locked) triple — built once per change, however many components ask. */
export function linkIndexFor(docs: Document[], types: DocumentTypeDef[], locked: PrivateLockedRefs = NO_LOCKED): LinkIndex {
  if (last && last.docs === docs && last.types === types && last.locked === locked) return last.index;
  const index = buildLinkIndex(docs, types, locked);
  last = { docs, types, locked, index };
  return index;
}

/** The live link index over every Document (ADR 0018). A React hook; every mount shares one build per change. */
export function useLinkIndex(): LinkIndex {
  const docs = useAllDocuments();
  const types = useDocumentTypes();
  const locked = usePrivateLockedRefs();
  return useMemo(() => linkIndexFor(docs, types, locked), [docs, types, locked]);
}

/** Backlinks ("mentioned in") of one Document. A React hook. */
export function useBacklinks(docId: string | undefined): Backlink[] {
  const idx = useLinkIndex();
  return docId ? idx.backlinksTo(docId) : [];
}

export interface BacklinkRow extends Backlink {
  title: string;
  type: string;
  href: string;
}

/** Backlinks of one Document with the referrer's title and route resolved — for "Mentioned in" lists. A React hook. */
export function useBacklinkRows(docId: string | undefined): BacklinkRow[] {
  const idx = useLinkIndex();
  const types = useDocumentTypes();
  return useMemo(() => {
    if (!docId) return [];
    const defs = new Map(types.map((t) => [t.id, t]));
    return idx.backlinksTo(docId).map((b) => {
      const src = idx.byId.get(b.sourceId);
      const def = src ? defs.get(src.type) : undefined;
      return { ...b, title: src ? displayTitle(src, def) : "?", type: src?.type ?? "", href: src ? docHref(src, def) : "" };
    });
  }, [idx, types, docId]);
}
