import express, { type NextFunction, type Request, type Response } from "express";
import PocketBase from "pocketbase";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { getOAuthProtectedResourceMetadataUrl, mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { loadConfig, SCOPE_READ, SCOPE_WRITE, SCOPES } from "./config";
import { DevicePool, ExpectedError } from "./devices";
import { LifelineOAuth, LoginAttempts } from "./oauth";
import { macroToolSpec, TOOLS, type ToolSpec } from "./tools";

/**
 * Lifeline's remote MCP server (ADR 0062): OAuth for the person, then the
 * tools, each run by the Account's headless device. Stateless Streamable
 * HTTP — every POST builds a server for that token's scopes — so a restart or
 * a second machine loses nothing but warm caches.
 */

const config = loadConfig();
const mcpUrl = new URL("/mcp", config.baseUrl);

const admin = new PocketBase(config.pbUrl);
admin.autoCancellation(false);
await admin.collection(config.pbAccount.collection).authWithPassword(config.pbAccount.email, config.pbAccount.password, { autoRefreshThreshold: 30 * 60 });

const oauth = new LifelineOAuth(admin, config.pbUrl, config.redirectAllow);
const devices = new DevicePool(admin, config.pbUrl);

const INSTRUCTIONS = `Lifeline is the user's personal dashboard: tasks, chores, events, notes and more, all stored as Documents of a type.
Start with \`agenda\` for what is on (today is in its answer) and \`search_documents\` to find things. Items from the agenda are acted on by appId + itemId.
Create tasks, chores and events with their App's tools (tasks_add, chores_add, calendar_add_event); create_document is for notes and other body-first types.
Dates are YYYY-MM-DD, times HH:MM, in the user's local time. Ask before changing many things at once.
For how Lifeline itself works — what a Module does, where a feature lives — read the \`guide\`.
The user's Macros (saved lists of Commands run as one) are tools named macro_…; \`list_macros\` shows them and their steps.`;

const STATIC_NAMES = new Set(TOOLS.map((t) => t.name));

const INTERNAL_ERROR = "Lifeline could not do that just now (an internal error). Try again in a moment.";

/**
 * Whether a request needs the Account's Macro tools: listing tools, or
 * calling one that is not static. Only then is the device asked — an
 * \`initialize\` or a call to a static tool never waits on it.
 */
function wantsMacroTools(body: unknown): boolean {
  const messages = (Array.isArray(body) ? body : [body]) as { method?: string; params?: { name?: unknown } }[];
  return messages.some((m) => m?.method === "tools/list" || (m?.method === "tools/call" && !STATIC_NAMES.has(String(m.params?.name))));
}

/**
 * The tools for one request: the static catalogue and, when it may write and
 * the request needs them, the Account's headless Macros (ADR 0095). Macros are
 * the Account's data, so they come from its device, not from \`TOOLS\` at
 * import; the pool keeps each Account's list a while, so most requests don't
 * wait on the device. A device that cannot answer costs the Macro tools, never
 * the listing.
 */
async function toolsFor(auth: AuthInfo, body: unknown): Promise<ToolSpec[]> {
  if (!auth.scopes.includes(SCOPE_WRITE) || !wantsMacroTools(body)) return TOOLS;
  try {
    return [...TOOLS, ...(await devices.macroTools(String(auth.extra?.userId))).map(macroToolSpec)];
  } catch (err) {
    console.error("[macro tools]", err);
    return TOOLS;
  }
}

/**
 * One server per request, as stateless Streamable HTTP needs: a server serves
 * one transport at a time. Building one with every tool costs well under a
 * millisecond, so it is not cached.
 */
function buildServer(auth: AuthInfo, tools: ToolSpec[]): McpServer {
  const server = new McpServer({ name: "lifeline", version: "0.1.0" }, { instructions: INSTRUCTIONS });
  const userId = String(auth.extra?.userId);
  const canWrite = auth.scopes.includes(SCOPE_WRITE);
  for (const spec of tools) {
    if (spec.write && !canWrite) continue;
    server.registerTool(
      spec.name,
      {
        title: spec.title,
        description: spec.description,
        inputSchema: spec.input,
        annotations: { readOnlyHint: !spec.write, destructiveHint: false, openWorldHint: false },
      },
      async (args: Record<string, unknown>) => {
        try {
          const result = spec.local ? spec.local(args) : await devices.call(userId, spec.name, args, spec.write);
          return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
        } catch (err) {
          // The agent's own mistakes are its to read; anything else is logged here and never shown.
          if (err instanceof ExpectedError) return { content: [{ type: "text" as const, text: err.message }], isError: true };
          console.error(`[tool ${spec.name}]`, err);
          return { content: [{ type: "text" as const, text: INTERNAL_ERROR }], isError: true };
        }
      },
    );
  }
  return server;
}

const app = express();
// Behind Fly's proxy: client IPs come in X-Forwarded-For (the SDK's rate limits read them).
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.get("/healthz", (_req, res) => {
  res.type("text").send("ok");
});

// Discovery, dynamic client registration, /authorize, /token, /revoke.
app.use(
  mcpAuthRouter({
    provider: oauth,
    issuerUrl: config.baseUrl,
    resourceServerUrl: mcpUrl,
    scopesSupported: SCOPES,
    resourceName: "Lifeline",
  }),
);

// The sign-in page's form. Rate-limited per address: it is a password check.
const attempts = new LoginAttempts();
function limitLogins(req: Request, res: Response, next: NextFunction) {
  if (!attempts.hit(req.ip ?? "?")) {
    res.status(429).type("text").send("Too many attempts. Try again in a few minutes.");
    return;
  }
  next();
}
app.post("/oauth/login", limitLogins, express.urlencoded({ extended: false, limit: "8kb" }), (req, res) => {
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Content-Security-Policy", "frame-ancestors 'none'");
  void oauth.completeLogin(req.body ?? {}, res).catch((err) => {
    console.error("[login]", err);
    res.status(500).type("text").send("Sign-in failed. Try again.");
  });
});

const bearer = requireBearerAuth({
  verifier: oauth,
  requiredScopes: [SCOPE_READ],
  resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(mcpUrl),
});

app.post("/mcp", bearer, express.json({ limit: "1mb" }), async (req, res) => {
  const auth = req.auth!;
  if (auth.resource && auth.resource.href !== mcpUrl.href) {
    res.status(401).json({ error: "invalid_token", error_description: "Token was issued for another resource" });
    return;
  }
  const server = buildServer(auth, await toolsFor(auth, req.body));
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("[mcp]", err);
    if (!res.headersSent) res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal error" }, id: null });
  }
});

// Stateless: no SSE stream to resume, no session to end.
app.all("/mcp", (_req, res) => {
  res.status(405).set("Allow", "POST").json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed" }, id: null });
});

const http = app.listen(config.port, () => console.log(`Lifeline MCP on :${config.port} — ${mcpUrl.href}`));

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    http.close();
    await devices.drain();
    process.exit(0);
  });
}
