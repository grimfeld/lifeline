/// <reference path="../pb_data/types.d.ts" />

// ADR 0018 / 0019: one `documents` collection for every user-facing record,
// `document_types` for user-defined types, `views` for saved Base Views.
// Moves every per-App collection's rows into `documents` (type fields packed
// into the `fields` JSON column) and drops the old collections. Big bang.

const AUTH_RULE = '@request.auth.id != ""';

function text(prefix, name, required, max) {
  return { autogeneratePattern: "", hidden: false, id: prefix + "_" + name, max: max ?? 0, min: 0, name, pattern: "", presentable: false, primaryKey: false, required: !!required, system: false, type: "text" };
}
function json(prefix, name) {
  return { hidden: false, id: prefix + "_" + name, maxSize: 0, name, presentable: false, required: false, system: false, type: "json" };
}
function number(prefix, name, onlyInt) {
  return { hidden: false, id: prefix + "_" + name, max: null, min: null, name, onlyInt: !!onlyInt, presentable: false, required: false, system: false, type: "number" };
}
function skeleton(prefix) {
  return [
    { autogeneratePattern: "[a-z0-9]{15}", hidden: false, id: prefix + "_id", max: 15, min: 1, name: "id", pattern: "^[a-z0-9]+$", presentable: false, primaryKey: true, required: true, system: true, type: "text" },
    text(prefix, "updatedAt", true, 40),
    { hidden: false, id: prefix + "_deleted", max: 1, min: 0, name: "deleted", onlyInt: true, presentable: false, required: false, system: false, type: "number" },
  ];
}
function autodates(prefix) {
  return [
    { hidden: false, id: prefix + "_created", name: "created", onCreate: true, onUpdate: false, presentable: false, system: false, type: "autodate" },
    { hidden: false, id: prefix + "_updated", name: "updated", onCreate: true, onUpdate: true, presentable: false, system: false, type: "autodate" },
  ];
}
function collection(name, prefix, fields, indexes) {
  return new Collection({
    name,
    type: "base",
    listRule: AUTH_RULE,
    viewRule: AUTH_RULE,
    createRule: AUTH_RULE,
    updateRule: AUTH_RULE,
    deleteRule: AUTH_RULE,
    fields: [...skeleton(prefix), ...fields, ...autodates(prefix)],
    indexes: indexes ?? [],
  });
}

const OLD = ["chores", "chore_completions", "tasks", "task_occurrences", "events", "stats", "stat_entries", "media", "media_quotes", "media_settings", "notes", "note_types", "sources"];

// --- helpers: read a record into a plain object ---------------------------------
function readRecord(col, r) {
  const out = {};
  for (const f of col.fields) {
    const name = f.getName();
    if (name === "created" || name === "updated") continue;
    const type = f.type();
    if (type === "json") {
      const raw = r.getString(name);
      try {
        out[name] = raw === "" ? null : JSON.parse(raw);
      } catch (_) {
        out[name] = null;
      }
    } else if (type === "number") out[name] = r.getFloat(name);
    else if (type === "bool") out[name] = r.getBool(name);
    else out[name] = r.getString(name);
  }
  return out;
}

function normTag(raw) {
  let t = String(raw).trim();
  if (t.startsWith("#")) t = t.slice(1);
  t = t.toLowerCase().replace(/\s+/g, "-").replace(/-{2,}/g, "-").replace(/\/{2,}/g, "/").replace(/^[/-]+|[/-]+$/g, "");
  return t || null;
}
function normTags(list) {
  const out = [];
  for (const r of Array.isArray(list) ? list : []) {
    const t = normTag(r);
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

// Frontmatter (YAML subset) — mirrors Core's parseYamlSubset.
const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
function unquote(s) {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1);
  return t;
}
function parseYaml(src) {
  const out = {};
  const lines = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(lines[i]);
    if (!m) continue;
    const key = m[1];
    const rest = m[2].trim();
    if (rest === "") {
      const items = [];
      while (i + 1 < lines.length && /^\s+-\s*/.test(lines[i + 1])) items.push(unquote(lines[++i].replace(/^\s+-\s*/, "")));
      out[key] = items;
    } else if (rest.startsWith("[") && rest.endsWith("]")) {
      out[key] = rest.slice(1, -1).split(",").map((s) => unquote(s.trim())).filter(Boolean);
    } else {
      const v = unquote(rest);
      out[key] = /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v;
    }
  }
  return out;
}
function splitFrontmatter(text) {
  const m = FM_RE.exec(text || "");
  if (!m) return { props: {}, content: text || "" };
  return { props: parseYaml(m[1]), content: text.slice(m[0].length) };
}
function proseTags(content) {
  const out = [];
  let inFence = false;
  for (const line of content.split("\n")) {
    if (/^\s{0,3}(```|~~~)/.test(line)) inFence = !inFence;
    if (inFence || /^\s{0,3}#{1,6}\s/.test(line)) continue;
    const re = /(^|[\s(])#([\p{L}\p{N}_/-]*[\p{L}_/-][\p{L}\p{N}_/-]*)/gu;
    let m;
    while ((m = re.exec(line))) {
      const t = normTag(m[2]);
      if (t && !out.includes(t)) out.push(t);
    }
  }
  return out;
}
function fmTagWords(props) {
  const v = props.tags;
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === "string" || typeof v === "number") return String(v).split(/[,\s]+/).filter(Boolean);
  return [];
}
function geoFrom(v) {
  const parts = Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : [];
  if (parts.length !== 2) return null;
  const lat = Number(String(parts[0]).trim());
  const lon = Number(String(parts[1]).trim());
  if (!isFinite(lat) || !isFinite(lon)) return null;
  return [lat, lon];
}

const COMMON = ["id", "updatedAt", "deleted", "type", "title", "body", "tags", "folder", "createdAt"];

migrate(
  (app) => {
    // 1. New collections.
    app.save(
      collection(
        "documents",
        "doc",
        [text("doc", "type", true, 60), text("doc", "title", false, 0), text("doc", "body", false, 0), json("doc", "tags"), text("doc", "folder", false, 0), json("doc", "fields"), text("doc", "createdAt", false, 40)],
        ["CREATE INDEX idx_documents_type ON documents (type)", "CREATE INDEX idx_documents_updated ON documents (updated)"],
      ),
    );
    app.save(
      collection("document_types", "dty", [
        text("dty", "typeId", true, 60),
        text("dty", "label", true, 100),
        text("dty", "plural", false, 100),
        text("dty", "icon", false, 40),
        text("dty", "folder", false, 0),
        json("dty", "fields"),
        text("dty", "body", false, 20),
        { hidden: false, id: "dty_linkable", name: "linkable", presentable: false, required: false, system: false, type: "bool" },
        text("dty", "locatableField", false, 60),
        text("dty", "template", false, 0),
        number("dty", "order", true),
      ]),
    );
    app.save(
      collection("views", "vw", [
        text("vw", "type", true, 60),
        text("vw", "name", true, 100),
        text("vw", "layout", false, 20),
        json("vw", "filters"),
        text("vw", "search", false, 0),
        text("vw", "sortBy", false, 60),
        text("vw", "sortDir", false, 10),
        json("vw", "columns"),
        number("vw", "sort", true),
      ]),
    );

    const docs = app.findCollectionByNameOrId("documents");
    const typesCol = app.findCollectionByNameOrId("document_types");

    function writeDoc(d) {
      const rec = new Record(docs);
      rec.set("id", d.id);
      rec.set("updatedAt", d.updatedAt || new Date().toISOString());
      rec.set("deleted", d.deleted ? 1 : 0);
      rec.set("type", d.type);
      rec.set("title", d.title ?? "");
      rec.set("body", d.body ?? "");
      rec.set("tags", Array.isArray(d.tags) ? d.tags : []);
      rec.set("folder", d.folder ?? "");
      rec.set("createdAt", d.createdAt ?? "");
      const fields = {};
      for (const [k, v] of Object.entries(d)) if (!COMMON.includes(k) && v !== undefined) fields[k] = v;
      rec.set("fields", fields);
      app.save(rec);
    }

    /** Generic move: every row of `from` → documents of `type`; `map(row) → partial common keys` (title/createdAt/renames). */
    function move(from, type, map) {
      let col;
      try {
        col = app.findCollectionByNameOrId(from);
      } catch (_) {
        return 0;
      }
      const rows = app.findAllRecords(from);
      let n = 0;
      for (const r of rows) {
        const row = readRecord(col, r);
        const extra = map ? map(row) : {};
        const d = { ...row, ...extra, type };
        d.tags = normTags(d.tags);
        d.folder = d.folder ?? "";
        d.title = d.title ?? "";
        if (typeof d.body !== "string") d.body = "";
        writeDoc(d);
        n++;
      }
      return n;
    }

    // 2. Structured Apps.
    move("tasks", "task", () => ({}));
    move("task_occurrences", "task_occurrence", (r) => ({ title: "", createdAt: "" }));
    move("chores", "chore", (r) => ({ title: r.name, name: undefined }));
    move("chore_completions", "chore_completion", (r) => ({ title: "", createdAt: r.doneOn || "" }));
    move("events", "event", () => ({}));
    move("stats", "stat", (r) => ({ title: r.name, name: undefined }));
    move("stat_entries", "stat_entry", (r) => ({ title: r.item ? String(r.item) : "", createdAt: String(r.ts || "").slice(0, 10) }));
    move("media", "media", (r) => ({ medium: r.type, type: undefined, createdAt: r.addedOn || "" }));
    move("media_quotes", "quote", (r) => ({ title: "“" + String(r.text || "").replace(/\s+/g, " ").trim().slice(0, 48) + "”", createdAt: r.capturedOn || "" }));
    move("media_settings", "media_settings", () => ({ title: "Media lookup settings", createdAt: "" }));
    move("sources", "source", (r) => ({ title: r.name, name: undefined }));

    // 3. Notes: frontmatter → fields, type mapping, tags ∪ prose tags.
    const NOTE_TYPE_MAP = { plain: "note", daily: "daily", template: "template" };
    let notesCol = null;
    try {
      notesCol = app.findCollectionByNameOrId("notes");
    } catch (_) {}
    if (notesCol) {
      for (const r of app.findAllRecords("notes")) {
        const row = readRecord(notesCol, r);
        const { props, content } = splitFrontmatter(row.body || "");
        const oldType = row.type || "plain";
        const type = NOTE_TYPE_MAP[oldType] || oldType;
        const d = {
          id: row.id,
          updatedAt: row.updatedAt,
          deleted: row.deleted,
          type,
          title: row.title || "",
          body: content,
          folder: row.folder || "",
          createdAt: row.createdAt || "",
          tags: normTags([...fmTagWords(props), ...proseTags(content)]),
        };
        for (const [k, v] of Object.entries(props)) {
          if (k === "tags") continue;
          if (k === "location" || k === "geo") d.location = geoFrom(v);
          else if (k === "conflictOf") d.conflictOf = v;
          else d[k] = v;
        }
        writeDoc(d);
      }
    }

    // 4. Note types → document_types (user-defined); person/place become user-defined types unless already overridden.
    const seen = new Set();
    let noteTypesCol = null;
    try {
      noteTypesCol = app.findCollectionByNameOrId("note_types");
    } catch (_) {}
    function writeType(t) {
      const rec = new Record(typesCol);
      rec.set("id", t.id);
      rec.set("updatedAt", t.updatedAt || new Date().toISOString());
      rec.set("deleted", t.deleted ? 1 : 0);
      rec.set("typeId", t.typeId);
      rec.set("label", t.label);
      rec.set("plural", t.plural || t.label);
      rec.set("icon", t.icon || "file-text");
      rec.set("folder", t.folder || "");
      rec.set("fields", t.fields || []);
      rec.set("body", t.body || "required");
      rec.set("linkable", t.linkable !== false);
      rec.set("locatableField", t.locatableField || "");
      rec.set("template", t.template || "");
      rec.set("order", t.order || 0);
      app.save(rec);
      seen.add(t.typeId);
    }
    if (noteTypesCol) {
      for (const r of app.findAllRecords("note_types")) {
        const row = readRecord(noteTypesCol, r);
        const props = Array.isArray(row.properties) ? row.properties : [];
        const fields = props.map((p) => ({ key: p.key, label: p.label || p.key, kind: p.kind, options: p.options }));
        const geo = fields.find((f) => f.kind === "geo");
        // Overrides of plain/daily/template keep their typeId mapped to the new built-in ids.
        const typeId = NOTE_TYPE_MAP[row.typeId] || row.typeId;
        writeType({ ...row, typeId, fields, body: "required", linkable: true, locatableField: geo ? geo.key : "" });
      }
    }
    const rnd = () => {
      const a = "abcdefghijklmnopqrstuvwxyz0123456789";
      let s = "";
      for (let i = 0; i < 15; i++) s += a[Math.floor(Math.random() * a.length)];
      return s;
    };
    if (!seen.has("person")) {
      writeType({
        id: rnd(), typeId: "person", label: "Person", plural: "People", icon: "user", folder: "People", order: 1, body: "required", linkable: true,
        fields: [
          { key: "aliases", label: "Aliases", kind: "list" },
          { key: "relationship", label: "Relationship", kind: "select", options: [{ value: "family", label: "Family" }, { value: "friend", label: "Friend" }, { value: "colleague", label: "Colleague" }, { value: "acquaintance", label: "Acquaintance" }, { value: "other", label: "Other" }] },
          { key: "birthday", label: "Birthday", kind: "date" },
        ],
      });
    }
    if (!seen.has("place")) {
      writeType({
        id: rnd(), typeId: "place", label: "Place", plural: "Places", icon: "map-pin", folder: "Places", order: 2, body: "required", linkable: true, locatableField: "location",
        fields: [
          { key: "aliases", label: "Aliases", kind: "list" },
          { key: "address", label: "Address", kind: "text" },
          { key: "location", label: "Coordinates", kind: "geo" },
          { key: "kind", label: "Kind", kind: "select", options: [{ value: "home", label: "Home" }, { value: "restaurant", label: "Restaurant" }, { value: "city", label: "City" }, { value: "venue", label: "Venue" }, { value: "other", label: "Other" }] },
        ],
      });
    }

    // 5. Drop the old collections.
    for (const name of OLD) {
      try {
        const c = app.findCollectionByNameOrId(name);
        app.delete(c);
      } catch (_) {}
    }
  },
  (app) => {
    // Down: the old collections are gone; only the new ones can be dropped. Restore from a backup if needed.
    for (const name of ["views", "document_types", "documents"]) {
      try {
        app.delete(app.findCollectionByNameOrId(name));
      } catch (_) {}
    }
  },
);
