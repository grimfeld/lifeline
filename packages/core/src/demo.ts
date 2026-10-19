/**
 * The Demo switch (CONTEXT.md "Demo", ADR 0077). Everything asks `isDemo()`.
 *
 * In the Demo there is no backend: sync never starts, the PocketBase client
 * is never used, and nothing offers to sign in. The real and Tauri builds
 * never set it.
 *
 * The shell's vite.config.ts turns the build's `VITE_DEMO=1` into the literal
 * `__LIFELINE_DEMO__`, so in the real build `isDemo()` is a constant `false`
 * and every Demo branch — the banner, the made-up life, Reset — is dropped
 * from the bundle (ADR 0077: the real bundle carries no Demo path). Where no
 * bundler defines it (tests, the MCP server) it is not the Demo.
 */
declare const __LIFELINE_DEMO__: boolean | undefined;
declare const __LIFELINE_DEMO_SOURCE_URL__: string | undefined;

const DEMO = typeof __LIFELINE_DEMO__ !== "undefined" && __LIFELINE_DEMO__;
const SOURCE_URL = (DEMO && typeof __LIFELINE_DEMO_SOURCE_URL__ !== "undefined" && __LIFELINE_DEMO_SOURCE_URL__) || undefined;

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
  return SOURCE_URL;
}
