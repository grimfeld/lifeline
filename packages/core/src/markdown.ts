/**
 * Pure markdown helpers (ADR 0009). Everything here reads a note's text and
 * derives — nothing is stored back except through `serializeFrontmatter`
 * and `renameLinks`, which produce new text.
 */

import { normalizeTag } from "./tags";

export type PropertyValue = string | number | string[];
export type Properties = Record<string, PropertyValue>;

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/** Split a note into its frontmatter block and the rest. Frontmatter is a small YAML subset. */
export function splitFrontmatter(text: string): { properties: Properties; content: string; raw: string } {
  const m = FM_RE.exec(text);
  if (!m) return { properties: {}, content: text, raw: "" };
  return { properties: parseYamlSubset(m[1]), content: text.slice(m[0].length), raw: m[0] };
}

/**
 * YAML subset: `key: value`, `key: [a, b]`, and block lists
 * (`key:` followed by `  - item` lines). Numbers become numbers; quotes stripped.
 */
export function parseYamlSubset(src: string): Properties {
  const out: Properties = {};
  const lines = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1];
    const rest = m[2].trim();
    if (rest === "") {
      const items: string[] = [];
      while (i + 1 < lines.length && /^\s+-\s*/.test(lines[i + 1])) {
        items.push(unquote(lines[++i].replace(/^\s+-\s*/, "")));
      }
      out[key] = items;
    } else if (rest.startsWith("[") && rest.endsWith("]")) {
      out[key] = rest
        .slice(1, -1)
        .split(",")
        .map((s) => unquote(s.trim()))
        .filter(Boolean);
    } else {
      const v = unquote(rest);
      out[key] = /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v;
    }
  }
  return out;
}

function unquote(s: string): string {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1);
  return t;
}

function isNumeric(s: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(s);
}

function quoteIfNeeded(s: string): string {
  return /[:#\[\]{}",']|^\s|\s$/.test(s) || s === "" ? JSON.stringify(s) : s;
}

/** Serialize properties as a frontmatter block ("" when empty). Empty values are dropped. */
export function serializeFrontmatter(props: Properties): string {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(props)) {
    if (v === "" || v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      const items = v.filter((x) => x !== "");
      if (items.length === 0) continue;
      if (items.every(isNumeric)) {
        // Numeric lists (coordinates) read better inline: `location: [48.85, 2.35]`.
        lines.push(`${k}: [${items.join(", ")}]`);
      } else {
        lines.push(`${k}:`);
        for (const item of items) lines.push(`  - ${quoteIfNeeded(item)}`);
      }
    } else if (typeof v === "number") {
      lines.push(`${k}: ${v}`);
    } else {
      lines.push(`${k}: ${quoteIfNeeded(v)}`);
    }
  }
  return lines.length ? `---\n${lines.join("\n")}\n---\n` : "";
}

/** Read a `[lat, lon]` property (also tolerates a legacy "lat,lon" string). Null when absent or malformed. */
export function readCoords(v: PropertyValue | undefined): { lat: number; lon: number } | null {
  const parts = Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : [];
  if (parts.length !== 2) return null;
  const lat = Number(String(parts[0]).trim());
  const lon = Number(String(parts[1]).trim());
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

/**
 * A note's coordinates. By default the `location` property (or the pre-ADR-0011
 * `geo: "lat,lon"` string from early imports); pass `key` to read a
 * Coordinates property stored under another name (user-defined types).
 */
export function noteCoords(props: Properties, key?: string): { lat: number; lon: number } | null {
  if (key && key !== "location" && key !== "geo") return readCoords(props[key]) ?? readCoords(props.location) ?? readCoords(props.geo);
  return readCoords(props.location) ?? readCoords(props.geo);
}

/** The property value for coordinates: `[lat, lon]` as strings, "" to clear. */
export function writeCoords(c: { lat: number; lon: number } | null): PropertyValue {
  return c ? [String(c.lat), String(c.lon)] : "";
}

/** Replace the note's frontmatter with `props`, keeping the content. */
export function withProperties(text: string, props: Properties): string {
  const { content } = splitFrontmatter(text);
  return serializeFrontmatter(props) + content;
}

export interface WikiLink {
  /** Target name as written (before `|` and `#`). */
  name: string;
  /** Display alias after `|`, if any. */
  alias?: string;
  /** Heading after `#`, if any. */
  heading?: string;
  from: number;
  to: number;
  /** True for `![[embed]]`. */
  embed: boolean;
}

const LINK_RE = /(!?)\[\[([^\]\n|#]+)(?:#([^\]\n|]+))?(?:\|([^\]\n]+))?\]\]/g;

const IMAGE_NAME_RE = /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i;

/** Whether a wikilink name is an image filename — `![[x.png]]` embeds an Attachment (ADR 0037), never a Document. */
export function isImageName(name: string): boolean {
  return IMAGE_NAME_RE.test(name.trim());
}

/** Whether a link is an Attachment embed: `![[…]]` of an image filename. */
export function isImageEmbed(link: Pick<WikiLink, "embed" | "name">): boolean {
  return link.embed && isImageName(link.name);
}

/** Every [[wikilink]] in the text with its offsets, skipping fenced code and inline code. */
export function extractLinks(text: string): WikiLink[] {
  const out: WikiLink[] = [];
  for (const seg of proseSegments(text)) {
    LINK_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = LINK_RE.exec(seg.text))) {
      out.push({
        embed: m[1] === "!",
        name: m[2].trim(),
        heading: m[3]?.trim(),
        alias: m[4]?.trim(),
        from: seg.offset + m.index,
        to: seg.offset + m.index + m[0].length,
      });
    }
  }
  return out;
}

/** A `#tag` in prose. Same word rules as Core's TAG_WORD_RE (ADR 0014) — `normalizeTag` is the single normaliser. */
const TAG_RE = /(^|[\s(])#([\p{L}\p{N}_/-]*[\p{L}_/-][\p{L}\p{N}_/-]*)/gu;

/**
 * The frontmatter `tags` property as raw words: a YAML list (one tag per
 * item), or a scalar split on commas/whitespace (`tags: a, b #c`). Not normalised.
 */
export function frontmatterTagWords(props: Properties): string[] {
  const v = props.tags;
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === "string" || typeof v === "number") return String(v).split(/[,\s]+/).filter(Boolean);
  return [];
}

/** `#tags` in the prose only (not in code, not the # of a heading, not bare numbers). Normalised, deduped, in order. */
export function extractProseTags(content: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const seg of proseSegments(content)) {
    for (const line of seg.text.split("\n")) {
      if (/^\s{0,3}#{1,6}\s/.test(line)) continue; // heading
      TAG_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = TAG_RE.exec(line))) {
        const t = normalizeTag(m[2]);
        if (t && !seen.has(t)) {
          seen.add(t);
          out.push(t);
        }
      }
    }
  }
  return out;
}

/**
 * A note's tags (ADR 0009/0014): the frontmatter `tags` list ∪ the prose
 * `#tags`, every one through `normalizeTag`, deduped. Frontmatter tags come
 * first (they are the "declared" ones), then prose tags in order of appearance.
 */
export function extractTags(text: string): string[] {
  const { properties, content } = splitFrontmatter(text);
  const out: string[] = [];
  for (const raw of frontmatterTagWords(properties)) {
    const t = normalizeTag(raw);
    if (t && !out.includes(t)) out.push(t);
  }
  for (const t of extractProseTags(content)) if (!out.includes(t)) out.push(t);
  return out;
}

export interface Heading {
  level: number;
  text: string;
  line: number;
}

export function extractHeadings(text: string): Heading[] {
  const out: Heading[] = [];
  let inFence = false;
  text.split("\n").forEach((line, i) => {
    if (/^\s{0,3}(```|~~~)/.test(line)) inFence = !inFence;
    if (inFence) return;
    const m = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (m) out.push({ level: m[1].length, text: m[2], line: i });
  });
  return out;
}

export interface FencedBlock {
  lang: string;
  /** Raw body between the fences. */
  body: string;
  from: number;
  to: number;
}

/** Fenced code blocks (``` or ~~~) with their language and full offsets. */
export function extractBlocks(text: string): FencedBlock[] {
  const out: FencedBlock[] = [];
  const re = /(^|\n)([ \t]{0,3})(```|~~~)([^\n]*)\n([\s\S]*?)(?:\n[ \t]{0,3}\3[ \t]*)(?=\n|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const start = m.index + m[1].length;
    out.push({ lang: m[4].trim().split(/\s+/)[0] ?? "", body: m[5], from: start, to: m.index + m[0].length });
  }
  // Also handle an empty fence "```lang\n```" (no body line)
  const emptyRe = /(^|\n)([ \t]{0,3})(```|~~~)([^\n]*)\n[ \t]{0,3}\3[ \t]*(?=\n|$)/g;
  while ((m = emptyRe.exec(text))) {
    const start = m.index + m[1].length;
    if (out.some((b) => b.from === start)) continue;
    out.push({ lang: m[4].trim().split(/\s+/)[0] ?? "", body: "", from: start, to: m.index + m[0].length });
  }
  return out.sort((a, b) => a.from - b.from);
}

/** Text outside fenced blocks and inline code, with offsets into the original. */
/** The prose parts of a markdown text with their offsets — fenced and inline code left out. What link and tag extraction walk. */
export function proseSegments(text: string): { text: string; offset: number }[] {
  const blocks = extractBlocks(text);
  const segs: { text: string; offset: number }[] = [];
  let pos = 0;
  for (const b of blocks) {
    if (b.from > pos) segs.push({ text: text.slice(pos, b.from), offset: pos });
    pos = b.to;
  }
  if (pos < text.length) segs.push({ text: text.slice(pos), offset: pos });
  // strip inline code by blanking it (keeps offsets)
  return segs.map((s) => ({ offset: s.offset, text: s.text.replace(/`[^`\n]*`/g, (m) => " ".repeat(m.length)) }));
}

/** Rewrite every [[Old]] / [[Old#h]] / [[Old|alias]] to the new name. Case-insensitive on the name. */
export function renameLinks(text: string, oldName: string, newName: string): string {
  return renameLinksMany(text, new Map([[normalizeName(oldName), newName]]));
}

/**
 * Several renames in one pass: `renames` maps a normalised old name to its new
 * name. One pass, so a link renamed once is never matched again by another pair.
 */
export function renameLinksMany(text: string, renames: ReadonlyMap<string, string>): string {
  if (renames.size === 0) return text;
  const links = extractLinks(text).filter((l) => renames.has(normalizeName(l.name)));
  if (links.length === 0) return text;
  let out = "";
  let pos = 0;
  for (const l of links) {
    const newName = renames.get(normalizeName(l.name))!;
    out += text.slice(pos, l.from);
    out += `${l.embed ? "!" : ""}[[${newName}${l.heading ? `#${l.heading}` : ""}${l.alias ? `|${l.alias}` : ""}]]`;
    pos = l.to;
  }
  return out + text.slice(pos);
}

/** Names compare case- and accent-insensitively, whitespace-collapsed (CONTEXT.md "Wikilink"). */
export function normalizeName(name: string): string {
  return foldName(name.trim().replace(/\s+/g, " "));
}

/** Fold one run of text the way names compare: decomposed, marks stripped, lower-cased. Length may change. */
export function foldName(text: string): string {
  return text.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase();
}

/** Parse the option lines of a Lifeline block body: `key: value` per line. */
export function parseBlockOptions(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of body.split("\n")) {
    const m = /^\s*([A-Za-z_-]+)\s*:\s*(.*)$/.exec(line);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

/** First ~n chars of prose (no frontmatter, no fences, no markdown syntax) for previews. */
export function excerpt(text: string, n = 160): string {
  const { content } = splitFrontmatter(text);
  const plain = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!?\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_, a, b) => b ?? a)
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_>`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > n ? plain.slice(0, n - 1) + "…" : plain;
}
