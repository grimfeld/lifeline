#!/usr/bin/env node
// Points git at scripts/git-hooks, so the hooks there run in every checkout and
// worktree with no manual step. The root `prepare` script runs this on `pnpm install`.
// Outside a git checkout (the MCP Docker build has no .git) it does nothing.
import { execFileSync } from "node:child_process";

try {
  execFileSync("git", ["rev-parse", "--git-dir"], { stdio: "ignore" });
} catch {
  process.exit(0);
}
// Relative, so each worktree runs the hooks of its own checkout.
execFileSync("git", ["config", "core.hooksPath", "scripts/git-hooks"], { stdio: "inherit" });
