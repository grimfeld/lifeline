#!/usr/bin/env node
// ADR numbers, kept unique while several branches and agents write ADRs at once.
//
//   node scripts/adr.mjs new "The title"   takes the next free number, writes docs/adr/NNNN-the-title.md
//   node scripts/adr.mjs mv docs/adr/NNNN-slug.md   moves that ADR to the next free number, same slug
//   node scripts/adr.mjs check             no number twice in docs/adr; warns when a number this
//                                          change adds is taken on another branch
//
// "Free" means above every number in docs/adr on any local or origin branch and in
// every worktree's folder, committed or not — so two agents on this machine never
// take the same one. ADR_BASE overrides the base ref of `check` (default origin/master).
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const DIR = "docs/adr";
const NAME = /^(\d{4})-.+\.md$/;
// Taken twice before this script existed. Each may stay at two files; a third fails.
const GRANDFATHERED = new Set(["0037", "0054"]);

const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] });
const gitIn = (input, ...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 1 << 28, input, stdio: ["pipe", "pipe", "ignore"] });
const lines = (s) => s.split("\n").filter(Boolean);
const adrs = (names) => names.filter((n) => NAME.test(n));
const number = (name) => NAME.exec(name)[1];

/** ADR file names on each ref, as Map<ref, names[]>. One process for the trees, one per distinct tree. */
function onRefs(refs) {
  if (!refs.length) return new Map();
  const trees = lines(gitIn(refs.map((r) => `${r}:${DIR}`).join("\n") + "\n", "cat-file", "--batch-check=%(objectname)"));
  const listed = new Map();
  const out = new Map();
  refs.forEach((ref, i) => {
    const tree = trees[i];
    if (!/^[0-9a-f]{40}$/.test(tree)) return;
    if (!listed.has(tree)) listed.set(tree, adrs(lines(git("ls-tree", "--name-only", tree))));
    out.set(ref, listed.get(tree));
  });
  return out;
}

/** ADR file names in every worktree's folder on disk, untracked ones included. */
function inWorktrees() {
  const out = [];
  for (const line of lines(git("worktree", "list", "--porcelain"))) {
    if (!line.startsWith("worktree ")) continue;
    const dir = join(line.slice(9), DIR);
    if (existsSync(dir)) out.push(...adrs(readdirSync(dir)));
  }
  return out;
}

function next() {
  try {
    git("fetch", "--quiet", "origin");
  } catch {
    console.warn("adr: could not fetch origin — numbers on branches pushed since the last fetch are not seen");
  }
  const refs = lines(git("for-each-ref", "--format=%(refname)", "refs/heads", "refs/remotes"));
  const names = [...[...onRefs(refs).values()].flat(), ...inWorktrees()];
  const highest = Math.max(0, ...names.map((n) => Number(number(n))));
  return String(highest + 1).padStart(4, "0");
}

function create(title) {
  if (!title) {
    console.error('usage: pnpm adr:new "The decision, as a sentence"');
    process.exit(1);
  }
  const slug = title.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const file = `${DIR}/${next()}-${slug}.md`;
  writeFileSync(file, `---\nstatus: accepted\n---\n\n# ${title}\n\n`, { flag: "wx" });
  console.log(file);
}

/** Moves an ADR to the next free number, keeping its slug. Contents and references are the caller's. */
function move(file) {
  const name = file && basename(file);
  if (!file || !existsSync(file) || resolve(dirname(file)) !== resolve(DIR) || !NAME.test(name)) {
    console.error(`usage: pnpm adr:mv ${DIR}/NNNN-slug.md   (an existing ADR)`);
    process.exit(1);
  }
  const to = `${DIR}/${next()}${name.slice(4)}`;
  // `git mv` so a tracked ADR keeps its history; one not yet added is just renamed.
  if (git("ls-files", "--", file).trim()) git("mv", file, to);
  else renameSync(file, to);
  console.log(to);
}

function check() {
  const problems = [];
  const here = adrs(readdirSync(DIR));
  const byNumber = Map.groupBy(here, number);
  for (const [n, files] of byNumber) {
    if (files.length > (GRANDFATHERED.has(n) ? 2 : 1)) problems.push(`${n} is taken by ${files.length} ADRs: ${files.join(", ")}`);
  }

  // Numbers this change adds, against branches that haven't merged into it. Not an error:
  // whichever merges first keeps the number, and the other renumbers (`pnpm adr:new` gives one).
  const baseRef = process.env.ADR_BASE ?? "origin/master";
  let base = git("merge-base", baseRef, "HEAD").trim();
  if (base === git("rev-parse", "HEAD").trim()) base = git("rev-parse", "HEAD~1").trim();
  const added = adrs(lines(git("diff", "--name-only", "--diff-filter=A", base, "HEAD", "--", DIR)).map((f) => f.slice(DIR.length + 1)));
  const others = onRefs(lines(git("for-each-ref", "--no-merged=HEAD", "--format=%(refname)", "refs/heads", "refs/remotes")));
  for (const name of added) {
    for (const [ref, names] of others) {
      const clash = names.find((n) => number(n) === number(name) && n !== name);
      if (clash) console.warn(`adr: warning — ${name} has the number of ${clash} on ${ref.replace(/^refs\/(heads|remotes)\//, "")}`);
    }
  }

  for (const p of problems) console.log(`${DIR}: ${p}`);
  if (problems.length) {
    console.log(`\nRenumber the newer ADR: \`pnpm adr:mv <file>\` moves it to a free number. Update its "ADR NNNN" references too.`);
    process.exit(1);
  }
  console.log("adr: numbers unique");
}

const [command, ...rest] = process.argv.slice(2);
if (command === "new") create(rest.join(" "));
else if (command === "mv") move(rest[0]);
else if (command === "check") check();
else {
  console.error("usage: node scripts/adr.mjs new <title> | mv <file> | check");
  process.exit(1);
}
