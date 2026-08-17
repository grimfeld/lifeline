#!/usr/bin/env node
// Obsidian vaults → Lifeline `notes` (daily / person / place / plain).
// Env: OBSIDIAN_VAULTS — comma-separated vault paths (default: the two Journal vaults).
// Reads every .md file (skips .obsidian/ and Templates/), maps folders to note
// types, merges people/places that exist in both vaults, and delivers through
// lib.mjs (dry-run by default, --apply to write). Ids are always fresh: vault
// files have no ids, so re-running an import creates duplicates — run it once.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";
import { deliver, newId, stamp, run } from "./lib.mjs";

const DEFAULT_VAULTS = [
  "/Users/paulperson/private/Obsidian/Journal",
  "/Users/paulperson/private/Obsidian/Journal on MacOS",
];
const PERSON_DIRS = new Set(["Personnes", "People"]);
const PLACE_DIRS = new Set(["Lieux", "Places"]);
const SKIP_DIRS = new Set(["Templates", ".obsidian", ".trash"]);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const GEO_LINK = /\[([^\]]*)\](?:\[\])?\(geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/;

// ---------- files ----------

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (entry.isFile() && entry.name.endsWith(".md")) yield path;
  }
}

/** Folder → note type. `null` = skip. */
function classify(relPath) {
  const parts = relPath.split(sep);
  const name = basename(relPath, ".md");
  const top = parts.length > 1 ? parts[0] : "";
  if (DATE.test(name) && (top === "Journal" || /^\d{4}$/.test(top))) return "daily";
  if (PERSON_DIRS.has(top)) return "person";
  if (PLACE_DIRS.has(top)) return "place";
  return "plain";
}

function fileDay(path) {
  const st = statSync(path);
  const d = st.birthtime.getTime() ? st.birthtime : st.mtime;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---------- frontmatter (small YAML subset) ----------

/** Split "---\n…\n---\nrest" → { fm: [{key, value}], rest }. value: string | string[] | null. */
function splitFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!m) return { fm: null, rest: text };
  const fm = [];
  for (const line of m[1].split(/\r?\n/)) {
    const item = /^\s+-\s*(.*)$/.exec(line);
    if (item && fm.length && Array.isArray(fm.at(-1).value)) {
      fm.at(-1).value.push(unquote(item[1]));
      continue;
    }
    const kv = /^([^\s:][^:]*):\s*(.*)$/.exec(line);
    if (!kv) {
      if (line.trim()) fm.push({ key: null, value: line });
      continue;
    }
    const [, key, raw] = kv;
    if (raw === "") fm.push({ key, value: [] }); // may become a block list, else empty
    else if (/^\[.*\]$/.test(raw)) fm.push({ key, value: raw.slice(1, -1).split(",").map((s) => unquote(s.trim())).filter(Boolean) });
    else fm.push({ key, value: unquote(raw) });
  }
  return { fm, rest: text.slice(m[0].length) };
}

function unquote(s) {
  const q = /^"(.*)"$|^'(.*)'$/.exec(s);
  return q ? (q[1] ?? q[2]).replace(/\\"/g, '"') : s;
}
function quote(s) {
  return /[:#\[\]"]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"` : s;
}

function serializeFrontmatter(fm) {
  const lines = [];
  for (const { key, value } of fm) {
    if (key === null) lines.push(value);
    else if (Array.isArray(value)) {
      if (!value.length) continue;
      lines.push(`${key}:`, ...value.map((v) => `  - ${quote(v)}`));
    } else lines.push(`${key}: ${quote(value)}`);
  }
  return lines.length ? `---\n${lines.join("\n")}\n---\n` : "";
}

const get = (fm, key) => fm.find((e) => e.key === key);
function setList(fm, key, items) {
  const e = get(fm, key);
  if (e) e.value = items;
  else fm.push({ key, value: items });
}
function setScalar(fm, key, value) {
  const e = get(fm, key);
  if (e) e.value = value;
  else fm.push({ key, value });
}
const asList = (v) => (v == null ? [] : Array.isArray(v) ? v : [String(v)]).map((s) => s.trim()).filter(Boolean);
const uniq = (xs) => [...new Set(xs)];

/** Person/place frontmatter clean-up: `alias` → `aliases` (list); empty `locations` dropped; geo link → geo/address. */
function normaliseEntity(type, fm, rest) {
  fm = fm ? fm.filter((e) => e.key !== "locations" || asList(e.value).length) : [];
  const aliases = uniq([...asList(get(fm, "aliases")?.value), ...asList(get(fm, "alias")?.value)]);
  fm = fm.filter((e) => e.key !== "alias");
  if (aliases.length || get(fm, "aliases")) setList(fm, "aliases", aliases);
  if (type === "place") {
    const g = GEO_LINK.exec(rest);
    if (g) {
      setScalar(fm, "geo", `${g[2]},${g[3]}`);
      if (g[1].trim() && !get(fm, "address")) setScalar(fm, "address", g[1].trim());
    }
  }
  return fm;
}

// ---------- merge ----------

const normTitle = (t) => t.normalize("NFC").trim().toLowerCase();

function mergeEntity(a, b, log) {
  // frontmatter: a's keys win, b adds missing ones, aliases union
  const fm = [...a.fm];
  for (const e of b.fm) {
    if (e.key === null || get(fm, e.key)) continue;
    fm.push(e);
  }
  setList(fm, "aliases", uniq([...asList(get(a.fm, "aliases")?.value), ...asList(get(b.fm, "aliases")?.value)]));
  const bodies = [a.rest, b.rest].map((s) => s.trim()).filter(Boolean);
  log.push(`${a.type} "${a.title}" ← ${a.source} + ${b.source}`);
  return { ...a, fm, rest: bodies.join("\n\n"), createdAt: a.createdAt < b.createdAt ? a.createdAt : b.createdAt };
}

// ---------- main ----------

await run(async () => {
  const vaults = (process.env.OBSIDIAN_VAULTS ? process.env.OBSIDIAN_VAULTS.split(",") : DEFAULT_VAULTS).map((s) => s.trim()).filter(Boolean);
  const drafts = new Map(); // `${type}:${normTitle}` → draft
  const stats = { files: 0, skippedEmpty: 0, merged: [], dailyDupes: [], perType: {} };

  for (const vault of vaults) {
    for (const path of walk(vault)) {
      stats.files++;
      const rel = relative(vault, path);
      const type = classify(rel);
      const title = basename(path, ".md").normalize("NFC");
      const text = readFileSync(path, "utf8");
      const { fm, rest } = splitFrontmatter(text);
      const source = `${basename(vault)}/${rel}`;

      if (type === "plain" && !rest.trim()) {
        stats.skippedEmpty++;
        continue;
      }
      const key = `${type}:${normTitle(title)}`;
      const existing = drafts.get(key);

      if (type === "daily") {
        const draft = { type, title, body: text, createdAt: title, source };
        if (existing) {
          const keep = text.length > existing.body.length ? draft : existing;
          stats.dailyDupes.push(`daily ${title}: kept ${keep.source} (${keep.body.length} chars) over the shorter copy`);
          drafts.set(key, keep);
        } else drafts.set(key, draft);
        continue;
      }
      if (type === "plain") {
        if (existing) {
          const keep = text.length > existing.body.length ? { type, title, body: text, createdAt: fileDay(path), source } : existing;
          stats.dailyDupes.push(`plain "${title}": kept ${keep.source} over the shorter copy`);
          drafts.set(key, keep);
        } else drafts.set(key, { type, title, body: text, createdAt: fileDay(path), source });
        continue;
      }
      // person / place
      const draft = { type, title, fm: normaliseEntity(type, fm, rest), rest, createdAt: fileDay(path), source };
      drafts.set(key, existing ? mergeEntity(existing, draft, stats.merged) : draft);
    }
  }

  const notes = [];
  for (const d of drafts.values()) {
    const body = d.body ?? serializeFrontmatter(d.fm) + d.rest.replace(/^\s*\n/, "");
    notes.push(stamp({ id: newId(), type: d.type, title: d.title, body, createdAt: d.createdAt }));
    stats.perType[d.type] = (stats.perType[d.type] ?? 0) + 1;
  }
  notes.sort((a, b) => a.type.localeCompare(b.type) || a.title.localeCompare(b.title));

  // Summary goes to stderr so stdout stays the record dump.
  const e = (s) => console.error(s);
  e(`# obsidian: ${stats.files} .md file(s) in ${vaults.length} vault(s) → ${notes.length} note(s)`);
  for (const [t, n] of Object.entries(stats.perType).sort()) e(`#   ${t.padEnd(7)} ${n}`);
  e(`#   skipped empty: ${stats.skippedEmpty}`);
  e(`#   merged duplicates: ${stats.merged.length}`);
  for (const m of stats.merged) e(`#     ${m}`);
  if (stats.dailyDupes.length) {
    e(`#   same-title copies (longer kept): ${stats.dailyDupes.length}`);
    for (const m of stats.dailyDupes) e(`#     ${m}`);
  }

  await deliver({ notes });
});
