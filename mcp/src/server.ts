import express, { type NextFunction, type Request, type Response } from "express";
import PocketBase from "pocketbase";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { getOAuthProtectedResourceMetadataUrl, mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { loadConfig, SCOPE_READ, SCOPE_WRITE, SCOPES } from "./config";
import { DevicePool, ExpectedError } from "./devices";
import { LifelineOAuth } from "./oauth";
import { TOOLS } from "./tools";

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
await admin.collection("_superusers").authWithPassword(config.pbSuperuserEmail, config.pbSuperuserPassword, { autoRefreshThreshold: 30 * 60 });

const oauth = new LifelineOAuth(admin, config.pbUrl);
const devices = new DevicePool(admin, config.pbUrl);

const INSTRUCTIONS = `Lifeline is the user's personal dashboard: tasks, chores, events, notes and more, all stored as Documents of a type.
Start with \`agenda\` for what is on (today is in its answer) and \`search_documents\` to find things. Items from the agenda are acted on by appId + itemId.
Create tasks, chores and events with their App's tools (tasks_add, chores_add, calendar_add_event); create_document is for notes and other body-first types.
Dates are YYYY-MM-DD, times HH:MM, in the user's local time. Ask before changing many things at once.`;

function buildServer(auth: AuthInfo): McpServer {
  const server = new McpServer({ name: "lifeline", version: "0.1.0" }, { instructions: INSTRUCTIONS });
  const userId = String(auth.extra?.userId);
  const canWrite = auth.scopes.includes(SCOPE_WRITE);
  for (const spec of TOOLS) {
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
          const result = await devices.call(userId, spec.name, args, spec.write);
          return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
        } catch (err) {
          if (!(err instanceof ExpectedError)) console.error(`[tool ${spec.name}]`, err);
          return { content: [{ type: "text" as const, text: (err as Error).message }], isError: true };
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
const attempts = new Map<string, { n: number; until: number }>();
function limitLogins(req: Request, res: Response, next: NextFunction) {
  const key = req.ip ?? "?";
  const now = Date.now();
  const a = attempts.get(key);
  if (a && a.until > now && a.n >= 10) {
    res.status(429).type("text").send("Too many attempts. Try again in a few minutes.");
    return;
  }
  attempts.set(key, a && a.until > now ? { n: a.n + 1, until: a.until } : { n: 1, until: now + 15 * 60_000 });
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
  const server = buildServer(auth);
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
