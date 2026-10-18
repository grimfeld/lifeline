/**
 * The Demo switch (CONTEXT.md "Demo", ADR 0077): the one place the build-time
 * `VITE_DEMO=1` is read. Everything else asks `isDemo()`.
 *
 * In the Demo there is no backend: sync never starts, the PocketBase client
 * is never used, and nothing offers to sign in. The real and Tauri builds
 * never set it.
 */
const DEMO = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_DEMO === "1";

/** Whether this is the Demo build. */
export function isDemo(): boolean {
  return DEMO;
}
