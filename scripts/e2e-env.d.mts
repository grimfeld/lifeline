export const PW_BROWSERS: string;
export const UI_CHECK_SPECS: string[];
export const NIGHTLY_SPECS: string[];
export function portFree(port: number, host: string, listen?: () => import("node:net").Server): Promise<boolean>;
export function free(port: number): Promise<boolean>;
export function preinstalledChromium(dir?: string, platform?: string, exists?: (p: string) => boolean, list?: (p: string) => string[]): string | undefined;
export function slotCount(env?: Record<string, string | undefined>, memory?: number): number;
export function tryTakeSlot(options: { dir: string; count: number; pid?: number; worktree: string; isAlive?: (pid: number) => boolean }):
  | { slot: number; release: () => void }
  | { holders: { pid: number; worktree: string }[] };
export function takeSlot(options: {
  count: number;
  dir?: string;
  worktree: string;
  pid?: number;
  isAlive?: (pid: number) => boolean;
  log?: (line: string) => void;
  sleep?: (ms: number) => Promise<void>;
  every?: number;
}): Promise<number | undefined>;
