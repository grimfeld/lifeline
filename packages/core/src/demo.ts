/**
 * The Demo switch (CONTEXT.md "Demo", ADR 0077): the one place the build-time
 * `VITE_DEMO=1` is read. Everything else asks `isDemo()`.
 *
 * In the Demo there is no backend: sync never starts, the PocketBase client
 * is never used, and nothing offers to sign in. The real and Tauri builds
 * never set it.
 */
const ENV = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
const DEMO = ENV?.VITE_DEMO === "1";
const SOURCE_URL = ENV?.VITE_DEMO_SOURCE_URL?.trim() || undefined;

/** Whether this is the Demo build. */
export function isDemo(): boolean {
  return DEMO;
}

/**
 * Where the Demo's Source link points (`VITE_DEMO_SOURCE_URL`), or undefined
 * when the build sets none — the link is then not shown (the repository is
 * private until it is published). Never set outside the Demo.
 */
export function demoSourceUrl(): string | undefined {
  return DEMO ? SOURCE_URL : undefined;
}
