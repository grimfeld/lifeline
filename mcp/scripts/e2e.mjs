// End-to-end check against a running server: the whole OAuth dance a client
// like claude.ai performs, then real tool calls through the MCP SDK client.
//   node scripts/e2e.mjs <base-url> <email> <password> <pocketbase-url>
// The PocketBase URL seeds the things an agent cannot create (accounts,
// allowances…) straight into the test user's Account before the first call.
import { createHash, randomBytes } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const [base = "http://localhost:8787", email, password, pbUrl = "http://127.0.0.1:8099"] = process.argv.slice(2);
const redirect = "http://localhost:9/callback";
const ok = (cond, what) => {
  if (!cond) throw new Error(`FAILED: ${what}`);
  console.log(`  ✓ ${what}`);
};

console.log("OAuth");
const unauth = await fetch(`${base}/mcp`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
ok(unauth.status === 401 && /resource_metadata/.test(unauth.headers.get("www-authenticate") ?? ""), "unauthenticated /mcp → 401 pointing at resource metadata");
const meta = await (await fetch(`${base}/.well-known/oauth-authorization-server`)).json();
ok(meta.registration_endpoint && meta.code_challenge_methods_supported?.includes("S256"), "authorization server metadata advertises DCR + S256");

const client = await (await fetch(meta.registration_endpoint, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ client_name: "e2e", redirect_uris: [redirect], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] }),
})).json();
ok(client.client_id, "dynamic client registration");

const verifier = randomBytes(32).toString("base64url");
const challenge = createHash("sha256").update(verifier).digest("base64url");
const authorize = new URL(meta.authorization_endpoint);
for (const [k, v] of Object.entries({ response_type: "code", client_id: client.client_id, redirect_uri: redirect, code_challenge: challenge, code_challenge_method: "S256", state: "xyz", scope: "lifeline:read lifeline:write", resource: `${base}/mcp` })) authorize.searchParams.set(k, v);
const page = await (await fetch(authorize, { redirect: "manual" })).text();
const request = page.match(/name="request" value="([^"]+)"/)?.[1];
ok(request, "authorize shows the sign-in page");

const wrong = await fetch(`${base}/oauth/login`, { method: "POST", redirect: "manual", body: new URLSearchParams({ request, email, password: "nope" }) });
ok(wrong.status === 401, "wrong password is refused");

const login = await fetch(`${base}/oauth/login`, { method: "POST", redirect: "manual", body: new URLSearchParams({ request, email, password, allow_write: "on" }) });
const back = new URL(login.headers.get("location") ?? "http://x/");
ok(login.status === 302 && back.searchParams.get("state") === "xyz" && back.searchParams.get("code"), "sign-in redirects back with code + state");

const tok = await (await fetch(meta.token_endpoint, {
  method: "POST",
  body: new URLSearchParams({ grant_type: "authorization_code", code: back.searchParams.get("code"), code_verifier: verifier, client_id: client.client_id, redirect_uri: redirect, resource: `${base}/mcp` }),
})).json();
ok(tok.access_token && tok.refresh_token && tok.scope.includes("lifeline:write"), "code → access + refresh tokens with write scope");

const replay = await fetch(meta.token_endpoint, { method: "POST", body: new URLSearchParams({ grant_type: "authorization_code", code: back.searchParams.get("code"), code_verifier: verifier, client_id: client.client_id, redirect_uri: redirect }) });
ok(replay.status === 400, "an authorization code works once");

const refreshed = await (await fetch(meta.token_endpoint, { method: "POST", body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: tok.refresh_token, client_id: client.client_id }) })).json();
ok(refreshed.access_token && refreshed.refresh_token !== tok.refresh_token, "refresh rotates both tokens");
const stale = await fetch(meta.token_endpoint, { method: "POST", body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: tok.refresh_token, client_id: client.client_id }) });
ok(stale.status === 400, "the old refresh token is dead");

console.log("Seed");
const pbAuth = await (await fetch(`${pbUrl}/api/collections/users/auth-with-password`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identity: email, password }) })).json();
ok(pbAuth.token, "signed in to PocketBase as the test user");
const seed = async (type, title, fields = {}) => {
  const now = new Date().toISOString();
  const r = await fetch(`${pbUrl}/api/collections/documents/records`, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: pbAuth.token },
    body: JSON.stringify({ type, title, body: "", tags: [], folder: "", fields, createdAt: now.slice(0, 10), updatedAt: now, deleted: 0, workspace: "" }),
  });
  const rec = await r.json();
  if (!r.ok) throw new Error(`seed ${type}: ${JSON.stringify(rec)}`);
  return rec.id;
};
const monthStart = new Date().toISOString().slice(0, 8) + "01";
const seeded = {
  account: await seed("ledger_account", "Checking", { flavor: "checking", openingBalance: 0, archived: false, importMapping: null }),
  groceries: await seed("ledger_category", "Groceries", { kind: "expense", group: "Food", target: 0, accumulating: false }),
  allowance: await seed("pocket_allowance", "Eating out", { name: "Eating out", period: "month", from: monthStart, to: "", amount: 10000, emoji: "", color: "" }),
  offence: await seed("swearjar_offence", "Swearing", { name: "Swearing", price: 100, emoji: "", color: "", archived: false }),
  milk: await seed("price_product", "Milk", { measure: "l", labels: [] }),
  shop: await seed("price_shop", "Corner shop", { note: "" }),
};
ok(Object.values(seeded).every(Boolean), "seeded the things an agent cannot create");

console.log("MCP");
const mcp = new Client({ name: "e2e", version: "0" });
await mcp.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${refreshed.access_token}` } } }));
const { tools } = await mcp.listTools();
const names = tools.map((t) => t.name);
console.log("  tools:", names.join(", "));
ok(names.includes("tasks_add") && names.includes("agenda"), "tools include generic ones and headless Commands");

const call = async (name, args = {}) => {
  const t0 = Date.now();
  const r = await mcp.callTool({ name, arguments: args });
  const text = r.content?.[0]?.text ?? "";
  console.log(`  → ${name} (${Date.now() - t0} ms)${r.isError ? " ERROR" : ""}: ${text.slice(0, 400)}`);
  return { error: !!r.isError, data: r.isError ? text : JSON.parse(text) };
};

const today = (await call("agenda")).data.today;
const tomorrow = new Date(Date.parse(today) + 86400000).toISOString().slice(0, 10);

const task = await call("tasks_add", { title: "Buy stamps", date: tomorrow, estimate: 15, tags: ["errands"] });
ok(!task.error && task.data.id, "tasks_add creates a task through the Tasks App");
const weekly = await call("tasks_add", { title: "Water plants", recurrence: { kind: "weekly", weekdays: [0, 1, 2, 3, 4, 5, 6] } });
ok(!weekly.error, "tasks_add accepts a recurrence");
const badRec = await call("tasks_add", { title: "x", recurrence: { kind: "daily" } });
ok(badRec.error && /kind must be/.test(badRec.data), "a bad recurrence is refused with a readable message");
const chore = await call("chores_add", { title: "Clean fridge", schedule: { kind: "interval", days: 14 } });
ok(!chore.error, "chores_add creates a chore");
const ev = await call("calendar_add_event", { title: "Dentist", date: tomorrow, start: "09:30", end: "10:15" });
ok(!ev.error, "calendar_add_event creates an event");
const badEv = await call("calendar_add_event", { title: "x", date: tomorrow, start: "10:00", end: "09:00" });
ok(badEv.error, "an event ending before it starts is refused");

const noTemplate = await call("calendar_add_from_template", { template: "No such template" });
ok(noTemplate.error && /no template called/.test(noTemplate.data), "calendar_add_from_template refuses an unknown template by title");
const noProject = await call("tasks_add", { title: "x", project: "No such project" });
ok(noProject.error && /no project called/.test(noProject.data), "a link argument resolves by exact title and refuses a miss");

const agenda = await call("agenda", { start: today, end: tomorrow });
const day = agenda.data.days[tomorrow] ?? [];
ok(day.some((x) => x.title === "Buy stamps") && day.some((x) => x.title === "Dentist" && x.start === "09:30"), "agenda shows the task and the event tomorrow");
ok((agenda.data.days[today] ?? []).some((x) => x.title === "Clean fridge" && x.urgency === "due-today"), "a new interval chore is due today");

const done = await call("complete_item", { appId: "tasks", itemId: task.data.id, on: tomorrow });
ok(!done.error, "complete_item ticks the task");
const after = await call("agenda", { start: tomorrow, end: tomorrow });
ok(after.data.days[tomorrow].some((x) => x.title === "Buy stamps" && x.done === tomorrow), "the agenda shows it done");

const moved = await call("move_item", { appId: "calendar", itemId: ev.data.id, to: today });
ok(!moved.error, "move_item moves the event");
const resched = await call("reschedule_timed", { appId: "calendar", itemId: ev.data.id, date: today, start: "14:00", end: "15:00" });
ok(!resched.error, "reschedule_timed retimes it");

const guarded = await call("update_document", { id: task.data.id, fields: { completedOn: null } });
ok(guarded.error, "a guarded/unknown field is refused");
const renamed = await call("update_document", { id: task.data.id, title: "Buy stamps & envelopes", fields: { notes: "post office" } });
ok(!renamed.error, "update_document renames and edits plain fields");

const noTask = await call("create_document", { type: "task", title: "sneaky" });
ok(noTask.error && /tasks_add/.test(noTask.data), "create_document refuses App-owned types and names the right tool");
const note = await call("create_document", { type: "note", title: "Agent note", body: "Hello from an agent #mcp" });
ok(!note.error, "create_document makes a note");
const priv = await call("create_document", { type: "note", title: "secret", folder: "Private" });
ok(priv.error, "the Private folder is refused");

const found = await call("search_documents", { query: "agent" });
ok(found.data.documents.some((d) => d.title === "Agent note"), "search finds the note");
const got = await call("get_document", { id: task.data.id });
ok(got.data.title === "Buy stamps & envelopes" && got.data.fields.notes === "post office", "get_document reads it back");
const types = await call("list_types", { type: "task" });
ok(types.data[0].fields.some((f) => f.key === "status" && f.guarded) || types.data[0].fields.length > 0, "list_types describes a type");

console.log("Money");
const spent = await call("ledger_add", { amount: 12.5, payee: "Lidl", account: "checking", category: "groceries" });
ok(!spent.error && /12[.,]50/.test(spent.data.message), "ledger_add records an expense, account and category named by title");
const again = await call("ledger_add", { amount: 3, payee: "lidl" });
ok(!again.error, "a known payee lends its account and category");
const future = await call("ledger_add", { amount: 5, account: "Checking", category: "Groceries", date: "2999-01-01" });
ok(future.error && /records what happened/.test(future.data), "the ledger refuses a day after today");
const noAccount = await call("ledger_add", { amount: 5, category: "Groceries" });
ok(noAccount.error && /Name the account/.test(noAccount.data), "no account and no known payee is an error, never a default");
const pizza = await call("pocket_spend", { allowance: "eating out", amount: 18, label: "Pizza" });
ok(!pizza.error && /82[.,]00/.test(pizza.data.message), "pocket_spend takes from the running Allowance and says what is left");
const noAllowance = await call("pocket_spend", { allowance: "Holidays", amount: 1 });
ok(noAllowance.error && /No allowance called/.test(noAllowance.data), "pocket_spend refuses an Allowance that does not run");
const fine = await call("swearjar_fine", { offence: "swearing" });
ok(!fine.error && /Swearing/.test(fine.data.message), "swearjar_fine fines an Offence named by name");
const futureFine = await call("swearjar_fine", { offence: "Swearing", date: "2999-01-01" });
ok(futureFine.error, "a fine in the future is refused");
const price = await call("prices_add", { product: "milk", shop: "Corner shop", price: 1.19 });
ok(!price.error && /Milk/.test(price.data.message), "prices_add records a shelf price");
const noProduct = await call("prices_add", { product: "Caviar", shop: "Corner shop", price: 99 });
ok(noProduct.error && /no product called/.test(noProduct.data), "prices_add never invents a Product");
ok(!names.includes("prices_scan"), "receipt scanning stays a dialog");

await mcp.close();
console.log("\nall checks passed");
