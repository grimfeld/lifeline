#!/usr/bin/env node
// PocketBase migration numbers, kept unique and in order while several branches and
// agents write migrations at once. Prod applies them on boot after every push to master.
//
//   node scripts/migrations.mjs next    the next free number: 100000 above every migration
//                                       on any local or origin branch and in every worktree
//   node scripts/migrations.mjs check   no number twice; every migration this change adds
//                                       sorts after the newest one on the base; warns when
//                                       another branch adds the same number
//
// A migration added below the base's newest still runs, but after migrations that were
// written against the schema it changes — the order differs from a fresh install's.
// MIGRATIONS_BASE overrides the base ref of `check` (default origin/master).
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = "pocketbase/pb_migrations";
const NAME = /^(\d{10})_.+\.js$/;
const STEP = 100000;
// Taken twice before this script existed. Each may stay at two files; a third fails.
const GRANDFATHERED = new Set(["1757300000", "1757600000"]);

const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] });
const gitIn = (input, ...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 1 << 28, input, stdio: ["pipe", "pipe", "ignore"] });
const lines = (s) => s.split("\n").filter(Boolean);
const migrations = (names) => names.filter((n) => NAME.test(n));
const number = (name) => NAME.exec(name)[1];
const newest = (names) => migrations(names).sort().at(-1);

/** Migration file names on each ref, as Map<ref, names[]>. One process for the trees, one per distinct tree. */
function onRefs(refs) {
  if (!refs.length) return new Map();
  const trees = lines(gitIn(refs.map((r) => `${r}:${DIR}`).join("\n") + "\n", "cat-file", "--batch-check=%(objectname)"));
  const listed = new Map();
  const out = new Map();
  refs.forEach((ref, i) => {
    const tree = trees[i];
    if (!/^[0-9a-f]{40}$/.test(tree)) return;
    if (!listed.has(tree)) listed.set(tree, migrations(lines(git("ls-tree", "--name-only", tree))));
    out.set(ref, listed.get(tree));
  });
  return out;
}

/** Migration file names in every worktree's folder on disk, untracked ones included. */
function inWorktrees() {
  const out = [];
  for (const line of lines(git("worktree", "list", "--porcelain"))) {
    if (!line.startsWith("worktree ")) continue;
    const dir = join(line.slice(9), DIR);
    if (existsSync(dir)) out.push(...migrations(readdirSync(dir)));
  }
  return out;
}

function next() {
  try {
    git("fetch", "--quiet", "origin");
  } catch {
    console.warn("migrations: could not fetch origin — numbers on branches pushed since the last fetch are not seen");
  }
  const refs = lines(git("for-each-ref", "--format=%(refname)", "refs/heads", "refs/remotes"));
  const names = [...[...onRefs(refs).values()].flat(), ...inWorktrees()];
  const highest = Math.max(0, ...names.map((n) => Number(number(n))));
  console.log(String(Math.floor(highest / STEP) * STEP + STEP));
}

function check() {
  const problems = [];
  const here = migrations(readdirSync(DIR));
  for (const [n, files] of Map.groupBy(here, number)) {
    if (files.length > (GRANDFATHERED.has(n) ? 2 : 1)) problems.push(`${n} is taken by ${files.length} migrations: ${files.join(", ")}`);
  }

  const baseRef = process.env.MIGRATIONS_BASE ?? "origin/master";
  let base = git("merge-base", baseRef, "HEAD").trim();
  if (base === git("rev-parse", "HEAD").trim()) base = git("rev-parse", "HEAD~1").trim();
  const added = migrations(lines(git("diff", "--name-only", "--diff-filter=A", base, "HEAD", "--", DIR)).map((f) => f.slice(DIR.length + 1)));
  const onBase = onRefs([baseRef]).get(baseRef) ?? [];
  const last = newest(onBase);
  for (const name of added) {
    if (last && name < last) problems.push(`${name} sorts before ${last}, the newest on ${baseRef}`);
  }

  // Numbers this change adds, against migrations other unmerged branches add. Not an error:
  // whichever merges first keeps the number, and the other renumbers.
  const known = new Set([...onBase, ...here]);
  const others = onRefs(lines(git("for-each-ref", "--no-merged=HEAD", "--format=%(refname)", "refs/heads", "refs/remotes")));
  for (const name of added) {
    const clashes = new Map();
    for (const [ref, names] of others) {
      const clash = names.find((n) => number(n) === number(name) && !known.has(n));
      if (clash) clashes.set(clash, [...(clashes.get(clash) ?? []), ref.replace(/^refs\/(heads|remotes)\//, "")]);
    }
    for (const [clash, refs] of clashes) console.warn(`migrations: warning — ${name} has the number of ${clash} on ${refs.join(", ")}`);
  }

  for (const p of problems) console.log(`${DIR}: ${p}`);
  if (problems.length) {
    console.log(`\nRenumber the newer migration (git mv): \`pnpm migrations:next\` gives a free number.`);
    process.exit(1);
  }
  console.log("migrations: numbers unique and in order");
}

const [command] = process.argv.slice(2);
if (command === "next") next();
else if (command === "check") check();
else {
  console.error("usage: node scripts/migrations.mjs next | check");
  process.exit(1);
}
