// Shared helpers for the legacy → Lifeline importers. Plain fetch against the
// PocketBase REST API; no SDK, no build step. Node 22+.
//
// Every importer: reads a legacy source, maps records to Lifeline's synced
// shape (15-char id, updatedAt, deleted 0), and either prints them
// (--dry-run, default) or upserts them into the Lifeline PocketBase (--apply).
// Legacy ids are reused where they are already 15-char PocketBase ids, so
// re-running an import is idempotent.

export function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1) return process.argv[i + 1] ?? true;
  return fallback;
}
export const flag = (name) => process.argv.includes(`--${name}`);

export function env(name, fallback) {
  const v = process.env[name] ?? fallback;
  if (v === undefined) {
    console.error(`Missing ${name}`);
    process.exit(2);
  }
  return v;
}

/** PocketBase date "2026-07-20 09:00:00.000Z" → ISO "2026-07-20T09:00:00.000Z". */
export const pbToIso = (s) => (s ? s.replace(" ", "T") : "");

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
export function newId() {
  const bytes = new Uint8Array(15);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}
export const isPbId = (s) => typeof s === "string" && /^[a-z0-9]{15}$/.test(s);
export const keepId = (s) => (isPbId(s) ? s : newId());

/** Local calendar day of an ISO instant. */
export function localDay(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function localTime(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function stamp(record) {
  return { deleted: 0, ...record, updatedAt: new Date().toISOString() };
}

/** Minimal PocketBase client: password auth + paged list + upsert by id. */
export class PB {
  constructor(url) {
    this.url = url.replace(/\/$/, "");
    this.token = "";
  }
  async login(email, password, collection = "users") {
    const res = await fetch(`${this.url}/api/collections/${collection}/auth-with-password`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identity: email, password }),
    });
    if (!res.ok) throw new Error(`${this.url}: login failed (${res.status})`);
    this.token = (await res.json()).token;
  }
  headers() {
    return { "content-type": "application/json", ...(this.token ? { authorization: this.token } : {}) };
  }
  async all(collection, params = {}) {
    const items = [];
    for (let page = 1; ; page++) {
      const q = new URLSearchParams({ page: String(page), perPage: "200", skipTotal: "1", ...params });
      const res = await fetch(`${this.url}/api/collections/${collection}/records?${q}`, { headers: this.headers() });
      if (!res.ok) throw new Error(`${this.url}: list ${collection} failed (${res.status}) ${await res.text()}`);
      const data = await res.json();
      items.push(...data.items);
      if (data.items.length < 200) break;
    }
    return items;
  }
  async upsert(collection, record) {
    const base = `${this.url}/api/collections/${collection}/records`;
    let res = await fetch(`${base}/${record.id}`, { method: "PATCH", headers: this.headers(), body: JSON.stringify(record) });
    if (res.status === 404) {
      res = await fetch(base, { method: "POST", headers: this.headers(), body: JSON.stringify(record) });
    }
    if (!res.ok) throw new Error(`${collection}/${record.id}: ${res.status} ${await res.text()}`);
    return res.json();
  }
}

/** Print (dry run) or write the mapped records. */
export async function deliver(batches) {
  const apply = flag("apply");
  if (!apply) {
    for (const [collection, records] of Object.entries(batches)) {
      console.log(`# ${collection}: ${records.length} record(s)`);
    }
    console.log(JSON.stringify(batches, null, 2));
    console.log("\nDry run. Re-run with --apply to write to Lifeline.");
    return;
  }
  const pb = new PB(env("LIFELINE_PB_URL", "http://127.0.0.1:8090"));
  await pb.login(env("LIFELINE_EMAIL"), env("LIFELINE_PASSWORD"));
  for (const [collection, records] of Object.entries(batches)) {
    let n = 0;
    for (const r of records) {
      await pb.upsert(collection, r);
      n++;
    }
    console.log(`${collection}: ${n} written`);
  }
}

/** Importers are short scripts: a failure should read as one line, not a stack. */
export async function run(fn) {
  try {
    await fn();
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
