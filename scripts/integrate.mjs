#!/usr/bin/env node
// Lands a batch of PRs on master through one integration branch, so the whole batch
// pays for one CI run instead of one per PR merged after the last (ADR 0096).
//
//   node scripts/integrate.mjs [<pr>...]   merges those PRs (default: every open, green,
//                                          non-draft PR on master, oldest first) into
//                                          integration/<date> off origin/master, pushes
//                                          it and opens one PR
//   node scripts/integrate.mjs --continue  after an ADR clash is fixed and committed:
//                                          merges the PRs still to come, then pushes
//   node scripts/integrate.mjs --drop <pr> rebuilds the branch without that PR (its
//                                          change broke the batch) and force-pushes it
//   --no-push (with any of them)           builds the branch here and stops: a preview of
//                                          what conflicts, nothing published
//
// Run it in a clean worktree of its own (`pnpm worktree:new integrate`): it switches
// that checkout to the integration branch.
//
// A PR that conflicts is skipped and reported; it joins the next batch once rebased.
// A migration whose number another file on the branch holds, or that sorts before
// master's newest, is renumbered (`migrations.mjs next`) in a commit of its own. An ADR
// number taken twice stops the script: renumbering an ADR is a judgement (CLAUDE.md:
// which moves, `formerly:`, references by meaning), so an agent does it, commits, and
// runs --continue.
//
// It never merges to master. The PR it opens lands with a merge commit
// (`gh api -X PUT repos/grimfeld/lifeline/pulls/<n>/merge -f merge_method=merge`,
// never squash), so each PR's own commits reach master and GitHub marks those PRs merged.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const EMAIL = "claude@grimfeld.tech";
const MIGRATIONS = "pocketbase/pb_migrations";
const MIGRATION = /^(\d{10})_.+\.js$/;

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "pipe"], ...opts });
const git = (...args) => run("git", ["-c", `user.email=${EMAIL}`, ...args]);
const gh = (...args) => run("gh", args);
const ok = (...args) => {
  try {
    git(...args);
    return true;
  } catch {
    return false;
  }
};
const lines = (s) => s.split("\n").filter(Boolean);
let push = true;

/** A PR is green when it has checks and every one finished without failing. */
export function isGreen(pr) {
  const checks = pr.statusCheckRollup ?? [];
  if (!checks.length) return false;
  return checks.every((c) =>
    c.__typename === "StatusContext" ? c.state === "SUCCESS" : c.status === "COMPLETED" && ["SUCCESS", "SKIPPED", "NEUTRAL"].includes(c.conclusion),
  );
}

/** The PRs a bare `integrate` takes: open on master, not drafts, not an integration branch, green; oldest first. */
export function batchOf(prs) {
  return prs
    .filter((pr) => pr.baseRefName === "master" && !pr.isDraft && !pr.headRefName.startsWith("integration/") && isGreen(pr))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((pr) => pr.number);
}

/**
 * Migrations a merge added that need a new number: one whose number another file in the
 * folder holds, or one sorting before `newestOnBase`. `all` is the folder after the merge.
 */
export function toRenumber(added, all, newestOnBase) {
  const number = (n) => MIGRATION.exec(n)[1];
  return added.filter((name) => all.some((other) => other !== name && number(other) === number(name)) || (newestOnBase && name < newestOnBase));
}

function statePath() {
  return join(git("rev-parse", "--absolute-git-dir").trim(), "integrate.json");
}
const load = () => JSON.parse(readFileSync(statePath(), "utf8"));
const save = (state) => writeFileSync(statePath(), JSON.stringify(state, null, 2) + "\n");

function requireClean() {
  if (git("status", "--porcelain").trim()) {
    console.error("integrate: the checkout has changes; commit them or start from a clean worktree (pnpm worktree:new integrate)");
    process.exit(1);
  }
}

function branchName() {
  const day = new Date().toISOString().slice(0, 10);
  const taken = new Set(lines(git("ls-remote", "--heads", "origin")).map((l) => l.split("refs/heads/")[1]));
  let name = `integration/${day}`;
  for (let i = 2; taken.has(name); i++) name = `integration/${day}-${i}`;
  return name;
}

function title(n) {
  return JSON.parse(gh("pr", "view", String(n), "--json", "title")).title;
}

/** Renumbers what this merge's migrations clash with; returns [from, to] pairs. */
function renumberMigrations() {
  if (!existsSync(MIGRATIONS)) return [];
  const added = lines(git("diff", "--name-only", "--diff-filter=A", "HEAD^1", "HEAD", "--", MIGRATIONS)).map((f) => f.slice(MIGRATIONS.length + 1)).filter((n) => MIGRATION.test(n));
  const onBase = lines(git("ls-tree", "--name-only", `origin/master:${MIGRATIONS}`)).filter((n) => MIGRATION.test(n)).sort();
  const moved = [];
  for (const name of toRenumber(added, readdirSync(MIGRATIONS).filter((n) => MIGRATION.test(n)), onBase.at(-1))) {
    const next = run("node", ["scripts/migrations.mjs", "next"]).trim();
    const to = name.replace(MIGRATION.exec(name)[1], next);
    git("mv", join(MIGRATIONS, name), join(MIGRATIONS, to));
    moved.push([name, to]);
  }
  if (moved.length) git("commit", "-m", `Renumber ${moved.map(([from, to]) => `${from} to ${to}`).join(", ")}`);
  return moved;
}

function adrClash() {
  try {
    run("node", ["scripts/adr.mjs", "check"], { env: { ...process.env, ADR_BASE: "origin/master" } });
    return null;
  } catch (e) {
    return (e.stdout || e.message).trim();
  }
}

/** Merges each PR still pending; stops (state saved) on an ADR clash. Returns true when all are through. */
function mergePending(state) {
  while (state.pending.length) {
    const n = state.pending[0];
    const ref = `refs/remotes/origin/pr/${n}`;
    // Fetched into a remote-tracking ref, so the pre-push hook sees its commits as already on GitHub.
    git("fetch", "--quiet", "origin", `+pull/${n}/head:${ref}`);
    const name = title(n);
    if (ok("merge-base", "--is-ancestor", ref, "HEAD")) {
      console.log(`skip    #${n} ${name}: already on the branch`);
      state.pending.shift();
      save(state);
      continue;
    }
    if (!ok("merge", "--no-ff", "-m", `Merge #${n}: ${name}`, ref)) {
      ok("merge", "--abort");
      console.log(`skip    #${n} ${name}: conflicts with the batch; rebase it on master for the next one`);
      state.skipped.push(n);
      state.pending.shift();
      save(state);
      continue;
    }
    console.log(`merge   #${n} ${name}`);
    for (const [from, to] of renumberMigrations()) {
      console.log(`        renumbered ${from} to ${to}`);
      state.renumbered.push(`#${n}: ${from} → ${to}`);
    }
    state.merged.push(n);
    state.pending.shift();
    save(state);
    const clash = adrClash();
    if (clash) {
      console.log(`\n${clash}\n`);
      console.log(`integrate: #${n} brings an ADR number the batch already holds. Move the narrower ADR`);
      console.log("with `pnpm adr:mv`, give it `formerly:` and fix its references (CLAUDE.md), commit,");
      console.log("then run `pnpm integrate --continue`.");
      process.exit(1);
    }
  }
  return true;
}

function body(state) {
  const list = (ns) => ns.map((n) => `- #${n}`).join("\n");
  return [
    "Lands these PRs on master together, gated by this PR's CI: the unit checks and the whole e2e suite, sharded (ADR 0096).",
    "",
    list(state.merged),
    ...(state.skipped.length ? ["", "Skipped (they conflict with the batch; rebase them for the next one):", "", list(state.skipped)] : []),
    ...(state.dropped?.length ? ["", "Dropped (they broke the batch's CI):", "", list(state.dropped)] : []),
    ...(state.renumbered.length ? ["", "Migrations renumbered:", "", ...state.renumbered.map((r) => `- ${r}`)] : []),
    "",
    `**Merge with a merge commit** (\`gh api -X PUT repos/grimfeld/lifeline/pulls/<this>/merge -f merge_method=merge\`), never squash: the PRs above then show as merged. If a case fails, \`pnpm integrate --drop <pr>\` rebuilds the branch without the PR it points at.`,
    "",
    "🤖 Generated with [Claude Code](https://claude.com/claude-code)",
  ].join("\n");
}

function publish(state, { force = false } = {}) {
  if (!state.merged.length) {
    console.log("integrate: nothing merged; nothing to push");
    rmSync(statePath());
    return;
  }
  if (!push) {
    console.log(`\nintegrate: ${state.branch} built here, not pushed (--no-push)`);
    return;
  }
  git("push", ...(force ? ["--force-with-lease"] : []), "-u", "origin", state.branch);
  const open = JSON.parse(gh("pr", "list", "--head", state.branch, "--state", "open", "--json", "number,url"));
  if (open.length) {
    // `gh pr edit` fails on this repo (docs/agents/issue-tracker.md); the REST API does not.
    gh("api", "-X", "PATCH", `repos/{owner}/{repo}/pulls/${open[0].number}`, "-f", `body=${body(state)}`);
    console.log(`\nintegrate: ${open[0].url} updated`);
  } else {
    const url = gh("pr", "create", "--base", "master", "--head", state.branch, "--title", `Integrate ${state.merged.map((n) => `#${n}`).join(", ")}`, "--body", body(state)).trim();
    console.log(`\nintegrate: ${url}`);
  }
  console.log("Merge it with `gh api -X PUT repos/grimfeld/lifeline/pulls/<n>/merge -f merge_method=merge` once its checks pass.");
}

function start(numbers) {
  requireClean();
  git("fetch", "--quiet", "origin");
  let batch = numbers;
  if (!batch.length) {
    const prs = JSON.parse(gh("pr", "list", "--state", "open", "--limit", "100", "--json", "number,isDraft,headRefName,baseRefName,createdAt,statusCheckRollup"));
    batch = batchOf(prs);
    if (!batch.length) {
      console.log("integrate: no open PR is green and ready");
      return;
    }
  }
  const branch = branchName();
  git("switch", "--quiet", "-c", branch, "origin/master");
  console.log(`integrate: ${branch} off origin/master, with ${batch.map((n) => `#${n}`).join(" ")}\n`);
  const state = { branch, pending: batch, merged: [], skipped: [], renumbered: [] };
  save(state);
  if (mergePending(state)) publish(state);
}

function resume() {
  requireClean();
  const state = load();
  if (mergePending(state)) publish(state);
}

function drop(n) {
  requireClean();
  const before = load();
  if (!before.merged.includes(n)) {
    console.error(`integrate: #${n} is not in ${before.branch} (${before.merged.map((m) => `#${m}`).join(" ")})`);
    process.exit(1);
  }
  git("fetch", "--quiet", "origin");
  git("switch", "--quiet", "-C", before.branch, "origin/master");
  console.log(`integrate: rebuilding ${before.branch} without #${n}; ADR fixes made by hand need making again\n`);
  const state = { branch: before.branch, pending: before.merged.filter((m) => m !== n), merged: [], skipped: [...before.skipped], renumbered: [], dropped: [...(before.dropped ?? []), n] };
  save(state);
  if (mergePending(state)) publish(state, { force: true });
}

function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--no-push");
  push = args.length === process.argv.length - 2;
  if (args[0] === "--continue") return resume();
  if (args[0] === "--drop" && /^\d+$/.test(args[1] ?? "")) return drop(Number(args[1]));
  if (args.every((a) => /^\d+$/.test(a))) return start(args.map(Number));
  console.error("usage: node scripts/integrate.mjs [<pr>...] | --continue | --drop <pr>");
  process.exit(1);
}

// Run as a script; imported (integrate.test.mjs), it only exports.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
