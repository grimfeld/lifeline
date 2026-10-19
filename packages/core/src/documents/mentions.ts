import { useMemo } from "react";
import { foldName, normalizeName, proseSegments, splitFrontmatter } from "../markdown";
import { contextAround, type LinkIndex } from "./links";

/**
 * Unlinked mentions (CONTEXT.md): a Linkable Document's title or alias
 * sitting in another Document's prose with no `[[…]]` around it. Everything
 * here is derived from the link index and a body; nothing is stored. Linking
 * is a text rewrite the user asks for — never automatic.
 */

/** One name the scanner looks for: a title or alias, and what `[[…]]` must say to reach its Document. */
export interface MentionName {
  name: string;
  canonical: string;
  targetId: string;
}

/** One plain-prose occurrence of a name. */
export interface MentionHit {
  from: number;
  to: number;
  /** The prose as written (casing and accents kept). */
  text: string;
  /** The matched name as declared (title or alias). */
  name: string;
  canonical: string;
  targetId: string;
}

/** An Unlinked mention seen from the target: which Document says it, and where. */
export interface UnlinkedMention {
  sourceId: string;
  hit: MentionHit;
  context: string;
}

interface Matcher {
  re: RegExp | null;
  byFolded: Map<string, MentionName>;
}

const WORD = "[\\p{L}\\p{N}]";
const LINK_SPAN_RE = /!?\[\[[^\]\n]*\]\]/g;
const URL_RE = /(?:https?:\/\/|www\.)\S+/g;

/** Names in a single regex, longest first so "Alex Doe" beats "Paul" at the same spot. Titles win over aliases on the same word. */
function compile(names: MentionName[]): Matcher {
  const byFolded = new Map<string, MentionName>();
  for (const n of names) {
    const k = normalizeName(n.name);
    if (k.length < 2) continue;
    const cur = byFolded.get(k);
    if (!cur || (cur.name !== cur.canonical && n.name === n.canonical)) byFolded.set(k, n);
  }
  if (byFolded.size === 0) return { re: null, byFolded };
  const alts = Array.from(byFolded.keys())
    .sort((a, b) => b.length - a.length || a.localeCompare(b))
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return { re: new RegExp(`(?<!${WORD})(?:${alts.join("|")})(?!${WORD})`, "gu"), byFolded };
}

/** The body with everything that is not plain prose blanked to spaces (offsets kept): frontmatter, code, wikilinks, URLs. */
function maskProse(body: string): string {
  const chars = new Array<string>(body.length).fill(" ");
  const { raw } = splitFrontmatter(body);
  for (const seg of proseSegments(body)) {
    for (let i = 0; i < seg.text.length; i++) chars[seg.offset + i] = seg.text[i];
  }
  for (let i = 0; i < raw.length; i++) chars[i] = " ";
  return chars
    .join("")
    .replace(LINK_SPAN_RE, (m) => " ".repeat(m.length))
    .replace(URL_RE, (m) => " ".repeat(m.length));
}

/** Fold text the way names compare while keeping a folded-index → original-index map (folding changes lengths). */
function foldWithMap(text: string): { folded: string; map: number[] } {
  let folded = "";
  const map: number[] = [];
  let pos = 0;
  let lastSpace = false;
  for (const ch of text) {
    const isSpace = /\s/.test(ch);
    if (isSpace && lastSpace) {
      pos += ch.length;
      continue;
    }
    lastSpace = isSpace;
    const f = isSpace ? " " : foldName(ch);
    for (let i = 0; i < f.length; i++) map.push(pos);
    folded += f;
    pos += ch.length;
  }
  map.push(text.length);
  return { folded, map };
}

function scan(body: string, m: Matcher): MentionHit[] {
  if (!m.re) return [];
  const { folded, map } = foldWithMap(maskProse(body));
  const out: MentionHit[] = [];
  m.re.lastIndex = 0;
  let hit: RegExpExecArray | null;
  while ((hit = m.re.exec(folded))) {
    const n = m.byFolded.get(hit[0]);
    if (!n) continue;
    const from = map[hit.index];
    const to = map[hit.index + hit[0].length];
    out.push({ from, to, text: body.slice(from, to), name: n.name, canonical: n.canonical, targetId: n.targetId });
  }
  return out;
}

/**
 * Every plain-prose occurrence of one of `names` in `body`: whole words,
 * case- and accent-insensitive, longest name first; never inside a wikilink,
 * code, a URL or frontmatter. One-character names are never offered.
 */
export function findMentions(body: string, names: MentionName[]): MentionHit[] {
  return scan(body, compile(names));
}

/** Rewrite hits into wikilinks: `[[Canonical]]` when the prose is the title verbatim, else `[[Canonical|prose]]`. */
export function linkMentions(body: string, hits: MentionHit[]): string {
  const sorted = [...hits].sort((a, b) => a.from - b.from);
  let out = "";
  let pos = 0;
  for (const h of sorted) {
    if (h.from < pos) continue; // overlapping hit — already rewritten
    out += body.slice(pos, h.from);
    out += h.text === h.canonical ? `[[${h.canonical}]]` : `[[${h.canonical}|${h.text}]]`;
    pos = h.to;
  }
  return out + body.slice(pos);
}

function toMentionNames(index: LinkIndex, only?: string): MentionName[] {
  const out: MentionName[] = [];
  for (const n of index.mentionNames()) {
    if (n.ref.kind !== "doc" || (only && n.ref.id !== only)) continue;
    out.push({ name: n.name, canonical: n.canonical, targetId: n.ref.id });
  }
  return out;
}

const matchers = new WeakMap<LinkIndex, Matcher>();
/** One compiled matcher per index build — the index is the only thing that changes the name set. */
function matcherFor(index: LinkIndex): Matcher {
  let m = matchers.get(index);
  if (!m) {
    m = compile(toMentionNames(index));
    matchers.set(index, m);
  }
  return m;
}

/** Source side: names of *other* Documents found in this Document's body. */
export function unlinkedIn(index: LinkIndex, docId: string): MentionHit[] {
  const d = index.byId.get(docId);
  const body = typeof d?.body === "string" ? d.body : "";
  if (!body) return [];
  return scan(body, matcherFor(index)).filter((h) => h.targetId !== docId);
}

/**
 * Target side: every other Document whose prose names this one, in index order.
 * Over `linkSources`, so an internal type's Documents never appear — a Writing's
 * Versions repeat its prose, and every mention in them is the Writing's own.
 */
export function unlinkedMentionsOf(index: LinkIndex, docId: string): UnlinkedMention[] {
  const own = compile(toMentionNames(index, docId));
  if (!own.re) return [];
  const out: UnlinkedMention[] = [];
  for (const d of index.linkSources) {
    if (d.id === docId || typeof d.body !== "string" || !d.body) continue;
    for (const hit of scan(d.body, own)) out.push({ sourceId: d.id, hit, context: contextAround(d.body, hit.from, hit.to) });
  }
  return out;
}

/** "Link all" from the target's side: the rewrites to make, one entry per source body, and the hits left alone. */
export interface LinkAllPlan {
  sources: { sourceId: string; hits: MentionHit[] }[];
  /** Hits a bulk link would have to guess at — linked one by one, never in bulk. */
  skipped: UnlinkedMention[];
}

/**
 * Plan linking every Unlinked mention of one Document in one go (ADR 0068,
 * amended). A bulk link that guesses wrong spreads the error through every
 * Day that says the name, so a hit is left alone when the name it matched is
 * also another Document's title or alias, when a longer name of another
 * Document covers it in the same prose ("Anna" inside "Anna Smith"), or when
 * the link it would write does not resolve back to this Document.
 */
export function planLinkAll(index: LinkIndex, docId: string, mentions: UnlinkedMention[] = unlinkedMentionsOf(index, docId)): LinkAllPlan {
  const owners = new Map<string, Set<string>>();
  for (const n of index.mentionNames()) {
    if (n.ref.kind !== "doc") continue;
    const k = normalizeName(n.name);
    const set = owners.get(k) ?? new Set<string>();
    set.add(n.ref.id);
    owners.set(k, set);
  }
  const global = matcherFor(index);
  const globalHits = new Map<string, MentionHit[]>();
  const hitsIn = (sourceId: string) => {
    let hits = globalHits.get(sourceId);
    if (!hits) {
      const b = index.byId.get(sourceId)?.body;
      hits = typeof b === "string" ? scan(b, global) : [];
      globalHits.set(sourceId, hits);
    }
    return hits;
  };
  const bySource = new Map<string, MentionHit[]>();
  const skipped: UnlinkedMention[] = [];
  for (const m of mentions) {
    const { hit } = m;
    const shared = (owners.get(normalizeName(hit.name))?.size ?? 0) > 1;
    const covered = !hitsIn(m.sourceId).some((g) => g.from === hit.from && g.to === hit.to && g.targetId === docId);
    const r = index.resolve(hit.canonical);
    const elsewhere = r.kind !== "doc" || r.id !== docId;
    if (shared || covered || elsewhere) {
      skipped.push(m);
      continue;
    }
    const list = bySource.get(m.sourceId) ?? [];
    list.push(hit);
    bySource.set(m.sourceId, list);
  }
  return { sources: [...bySource].map(([sourceId, hits]) => ({ sourceId, hits })), skipped };
}

/** React hooks over the live index — memoised per (index, docId) so an index rebuild is the only trigger. */
export function useUnlinkedIn(index: LinkIndex, docId: string): MentionHit[] {
  return useMemo(() => unlinkedIn(index, docId), [index, docId]);
}
export function useUnlinkedMentionsOf(index: LinkIndex, docId: string): UnlinkedMention[] {
  return useMemo(() => unlinkedMentionsOf(index, docId), [index, docId]);
}
