import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import type PocketBase from "pocketbase";
import type { MacroTool } from "./tools";
import type { DeviceAuth, DeviceRequest, DeviceResponse } from "./worker";

/**
 * The device pool (ADR 0062): one worker per Account that has called
 * recently. A worker holds the Account's whole store in memory, so the first
 * call after a cold start pays one full pull; later calls pull only what
 * changed. An idle worker is stopped — but never while it holds writes the
 * server has not taken yet. Each worker holds all of Core and a copy of its
 * Account, so the pool is capped: past MAX_DEVICES the least recently used
 * idle one is stopped, and pays a full pull again on its next call.
 */

const IDLE_MS = 15 * 60_000;
/** Warm devices kept at once, for a 512 MB machine (fly.toml). Busy ones are never stopped, so the pool may run over while they finish. */
const MAX_DEVICES = 4;
/** How long an Account's Macro tool list is reused before its device is asked again: a Macro made on another device shows within this. */
const MACRO_TOOLS_MS = 60_000;
const RETRY_MS = 30_000;
const CALL_TIMEOUT_MS = 60_000;
/** Lifetime of the per-Account PocketBase token a worker acts with. */
const TOKEN_SECONDS = 60 * 60;

/** Under Fly's kill_timeout (30 s): a shutdown flush must give up while there is still time to log what it leaves behind. */
const DRAIN_MS = 20_000;

export class ExpectedError extends Error {}

/**
 * What a write the server has not taken yet is reported as. The queue lives
 * only in the worker's memory — the machine has no volume, and the one store
 * that outlives it is the PocketBase that just refused the push — so it is
 * retried while this machine runs, and lost if it stops first. The agent is
 * told exactly that, not that it "will be retried": it should check before
 * relying on the change, and not simply repeat it (the retry may still land).
 */
export function unsyncedWrite(syncError: string): { unconfirmed: true; warning: string } {
  return {
    unconfirmed: true,
    warning: `Not yet saved to Lifeline's server (${syncError || "sync pending"}). It is held on the MCP server and retried every ${RETRY_MS / 1000} s, but is lost if that server restarts first. Check with get_document or agenda later before relying on it; do not repeat it blindly.`,
  };
}

type Outgoing = DeviceRequest extends infer R ? (R extends unknown ? Omit<R, "id"> : never) : never;

interface Device {
  worker: Worker;
  next: number;
  waiting: Map<number, { resolve: (r: DeviceResponse) => void; timer: NodeJS.Timeout }>;
  idleTimer?: NodeJS.Timeout;
  pending: number;
}

const WORKER_URL = new URL("./worker.mjs", import.meta.url);

/** The Accounts whose devices to stop to get back under `max`: least recently used first (the map's order), never one with a call or a write in flight. */
export function overCap(devices: Map<string, Pick<Device, "pending" | "waiting">>, max: number): string[] {
  let excess = devices.size - max;
  const out: string[] = [];
  for (const [userId, d] of devices) {
    if (excess <= 0) break;
    if (d.pending > 0 || d.waiting.size > 0) continue;
    out.push(userId);
    excess--;
  }
  return out;
}

export class DevicePool {
  /** In order of last use, oldest first. */
  private devices = new Map<string, Device>();
  private tokens = new Map<string, { auth: DeviceAuth; expires: number }>();
  private macros = new Map<string, { tools: MacroTool[]; until: number }>();
  /** Counts writes, so a Macro list read while one ran is not kept. */
  private writes = 0;

  constructor(
    private admin: PocketBase,
    private pbUrl: string,
  ) {}

  /**
   * A token acting as the Account, minted by PocketBase's `mcp_service.pb.js`
   * for the server's own account (#263) and reused until it nears expiry.
   */
  private async authFor(userId: string): Promise<DeviceAuth> {
    const cached = this.tokens.get(userId);
    if (cached && cached.expires - Date.now() > 10 * 60_000) return cached.auth;
    const minted = await this.admin.send<DeviceAuth>(`/api/lifeline/mcp/impersonate/${encodeURIComponent(userId)}`, { method: "POST", body: { seconds: TOKEN_SECONDS } });
    const r = minted.record;
    const auth: DeviceAuth = { token: minted.token, record: { id: r.id, email: r.email, collectionId: r.collectionId, collectionName: r.collectionName } };
    this.tokens.set(userId, { auth, expires: Date.now() + TOKEN_SECONDS * 1000 });
    return auth;
  }

  private spawn(userId: string): Device {
    const worker = new Worker(fileURLToPath(WORKER_URL), { workerData: { pbUrl: this.pbUrl } });
    const device: Device = { worker, next: 1, waiting: new Map(), pending: 0 };
    worker.on("message", (res: DeviceResponse) => {
      const w = device.waiting.get(res.id);
      if (!w) return;
      clearTimeout(w.timer);
      device.waiting.delete(res.id);
      device.pending = res.pending;
      w.resolve(res);
    });
    worker.on("error", (err) => console.error(`[device ${userId}]`, err));
    worker.on("exit", (code) => {
      if (this.devices.get(userId) === device) this.devices.delete(userId);
      if (!this.devices.has(userId)) {
        this.tokens.delete(userId);
        this.macros.delete(userId);
      }
      if (device.pending > 0) console.error(`[device ${userId}] stopped (exit ${code}) with ${device.pending} write(s) the server never took; they are lost`);
      for (const w of device.waiting.values()) {
        clearTimeout(w.timer);
        w.resolve({ id: 0, ok: false, error: `The Account's device stopped (exit ${code}); try again`, expected: false, pending: 0 });
      }
    });
    this.devices.set(userId, device);
    return device;
  }

  /** The Account's device, started if need be and moved to most recently used. */
  private deviceFor(userId: string): Device {
    const warm = this.devices.get(userId);
    if (warm) {
      this.devices.delete(userId);
      this.devices.set(userId, warm);
      return warm;
    }
    const device = this.spawn(userId);
    for (const id of overCap(this.devices, MAX_DEVICES)) void this.stop(id, this.devices.get(id)!);
    return device;
  }

  private async stop(userId: string, device: Device): Promise<void> {
    clearTimeout(device.idleTimer);
    if (this.devices.get(userId) === device) this.devices.delete(userId);
    await device.worker.terminate();
  }

  private send(userId: string, device: Device, req: Outgoing): Promise<DeviceResponse> {
    const id = device.next++;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        device.waiting.delete(id);
        resolve({ id, ok: false, error: "Lifeline took too long to answer", expected: false, pending: device.pending });
      }, CALL_TIMEOUT_MS);
      device.waiting.set(id, { resolve, timer });
      device.worker.postMessage({ ...req, id } as DeviceRequest);
    }).finally(() => this.armIdle(userId, device)) as Promise<DeviceResponse>;
  }

  /** Stop the worker once idle — or, while writes wait for the server, keep retrying them. */
  private armIdle(userId: string, device: Device): void {
    clearTimeout(device.idleTimer);
    const delay = device.pending > 0 ? RETRY_MS : IDLE_MS;
    device.idleTimer = setTimeout(async () => {
      if (device.waiting.size) return this.armIdle(userId, device);
      if (device.pending > 0) {
        await this.send(userId, device, { kind: "flush", auth: await this.authFor(userId) }).catch(() => undefined);
        return;
      }
      await this.stop(userId, device);
    }, delay);
  }

  /** Run one tool as the Account. Resolves to the tool's result; rejects with ExpectedError for the agent's own mistakes. */
  async call(userId: string, tool: string, args: Record<string, unknown>, write: boolean): Promise<unknown> {
    const auth = await this.authFor(userId);
    if (write) {
      this.writes++;
      this.macros.delete(userId);
    }
    const device = this.deviceFor(userId);
    const res = await this.send(userId, device, { kind: "call", tool, args, write, auth });
    if (res.ok) return res.result;
    throw res.expected ? new ExpectedError(res.error) : new Error(res.error);
  }

  /**
   * The Account's headless Macros as tools (ADR 0092): its own data, so its
   * device reads them. Kept for MACRO_TOOLS_MS and dropped by any write
   * through this server, so listing tools rarely waits on the device.
   */
  async macroTools(userId: string): Promise<MacroTool[]> {
    const hit = this.macros.get(userId);
    if (hit && hit.until > Date.now()) return hit.tools;
    const writes = this.writes;
    const auth = await this.authFor(userId);
    const res = await this.send(userId, this.deviceFor(userId), { kind: "macro-tools", auth });
    if (!res.ok) throw new Error(res.error);
    const tools = res.result as MacroTool[];
    if (writes === this.writes) this.macros.set(userId, { tools, until: Date.now() + MACRO_TOOLS_MS });
    return tools;
  }

  /** On shutdown: push what is still queued (within DRAIN_MS), then stop every worker; whatever is left is logged as lost. */
  async drain(): Promise<void> {
    await Promise.all(
      [...this.devices.entries()].map(async ([userId, device]) => {
        if (device.pending > 0) {
          const flush = (async () => this.send(userId, device, { kind: "flush", auth: await this.authFor(userId) }))().catch(() => undefined);
          await Promise.race([flush, new Promise((r) => setTimeout(r, DRAIN_MS).unref())]);
        }
        clearTimeout(device.idleTimer);
        await device.worker.terminate();
      }),
    );
  }
}
