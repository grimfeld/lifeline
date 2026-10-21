#!/usr/bin/env node
// Makes the worktree an agent works in, and removes the ones left behind once their
// work is on master.
//
//   node scripts/worktrees.mjs new <name>
//   node scripts/worktrees.mjs prune [--dry-run]
//
// `new` fetches origin, adds .claude/worktrees/<name> (under the main checkout) on a new
// branch <name> off origin/master, sets its commit email to claude@grimfeld.tech (this
// worktree only, through extensions.worktreeConfig), installs its packages (which also activates the git
// hooks) and makes sure Playwright's Chromium is there for the e2e tests.
//
// A worktree goes when all of these hold:
//   - it is not the main checkout;
//   - it is clean (nothing modified, nothing untracked outside .gitignore);
//   - its HEAD is on origin/master (the PR merged, or it never left master);
//   - nothing touched it for a day — a fresh worktree off master passes the other
//     tests while an agent is still starting on it.
// Its local branch goes too when the branch is merged into origin/master. A branch held
// by a worktree cannot be deleted, which is what made `gh pr merge --delete-branch` fail.
import { execFileSync } from "node:child_process";
import { existsSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const IDLE_MS = 24 * 60 * 60 * 1000;
const BASE = "origin/master";
const AGENT_EMAIL = "claude@grimfeld.tech";

const git = (cwd, ...args) => execFileSync("git", ["-c", "core.longpaths=true", ...args], { cwd, encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "pipe"] });
const ok = (cwd, ...args) => {
  try {
    git(cwd, ...args);
    return true;
  } catch {
    return false;
  }
};
const lines = (s) => s.split("\n").filter(Boolean);

/** Worktrees as { path, head, branch? }, main checkout first. */
function worktrees() {
  const out = [];
  for (const block of git(".", "worktree", "list", "--porcelain").split("\n\n")) {
    const fields = Object.fromEntries(lines(block).map((l) => [l.split(" ")[0], l.slice(l.indexOf(" ") + 1)]));
    if (fields.worktree) out.push({ path: fields.worktree, head: fields.HEAD, branch: fields.branch?.replace(/^refs\/heads\//, "") });
  }
  return out;
}

/** Last time git saw activity in the worktree: its index or HEAD, whichever is newer. */
function lastTouched(path) {
  const gitDir = git(path, "rev-parse", "--absolute-git-dir").trim();
  return Math.max(...["index", "HEAD", "logs/HEAD"].map((f) => {
    try {
      return statSync(join(gitDir, f)).mtimeMs;
    } catch {
      return 0;
    }
  }));
}

function prune(dryRun) {
  try {
    git(".", "fetch", "--quiet", "origin");
  } catch {
    console.warn("worktrees: could not fetch origin — judging against the last fetched master");
  }
  const [, ...others] = worktrees();
  let removed = 0;
  for (const wt of others) {
    const why =
      git(wt.path, "status", "--porcelain").trim() ? "has changes"
      : !ok(".", "merge-base", "--is-ancestor", wt.head, BASE) ? `not on ${BASE}`
      : Date.now() - lastTouched(wt.path) < IDLE_MS ? "touched in the last day"
      : null;
    if (why) {
      console.log(`keep    ${wt.path} (${wt.branch ?? "detached"}): ${why}`);
      continue;
    }
    console.log(`${dryRun ? "would remove" : "remove"}  ${wt.path} (${wt.branch ?? "detached"})`);
    if (dryRun) continue;
    // Git unregisters the worktree, then often gives up on the folder ("Directory not
    // empty": pnpm's node_modules junctions). Node deletes what it leaves.
    ok(".", "worktree", "remove", "--force", wt.path);
    if (worktrees().some((w) => w.path === wt.path)) {
      console.warn(`worktrees: git would not remove ${wt.path}`);
      continue;
    }
    rmSync(wt.path, { recursive: true, force: true, maxRetries: 3 });
    removed++;
    if (wt.branch && ok(".", "merge-base", "--is-ancestor", wt.branch, BASE)) git(".", "branch", "-D", wt.branch);
  }
  git(".", "worktree", "prune");
  console.log(`worktrees: ${dryRun ? "dry run" : `${removed} removed`}`);
}

function create(name) {
  if (!name || !/^[\w.-]+$/.test(name)) {
    console.error("usage: pnpm worktree:new <name>  (letters, digits, . _ -)");
    process.exit(1);
  }
  const [main] = worktrees();
  const path = join(main.path, ".claude", "worktrees", name);
  if (existsSync(path)) {
    console.error(`worktrees: ${path} already exists`);
    process.exit(1);
  }
  const run = (cwd, cmd, ...args) => execFileSync(cmd, args, { cwd, stdio: "inherit" });
  run(main.path, "git", "fetch", "origin");
  run(main.path, "git", "worktree", "add", "-b", name, path, BASE);
  // Agent commits carry the noreply email (the machine's own is private, and the pre-push
  // hook refuses it), set for this worktree only so the main checkout keeps the user's.
  run(main.path, "git", "config", "extensions.worktreeConfig", "true");
  run(path, "git", "config", "--worktree", "user.email", AGENT_EMAIL);
  run(path, "pnpm", "install");
  // A quick no-op when Chromium is already there.
  run(path, "pnpm", "--filter", "@lifeline/shell", "exec", "playwright", "install", "chromium");
  console.log(`\nworktrees: ready at ${path} on branch ${name}`);
}

const [command, ...flags] = process.argv.slice(2);
if (command === "prune") prune(flags.includes("--dry-run"));
else if (command === "new") create(flags[0]);
else {
  console.error("usage: node scripts/worktrees.mjs new <name> | prune [--dry-run]");
  process.exit(1);
}
