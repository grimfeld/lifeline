// node --test scripts/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { caseCounts, fileSeconds, matrix, pattern, plan } from "./e2e-shards.mjs";

/** A json report (or --list output) with these tests: file → [ms per try, …] per test. */
const report = (files) => ({
  suites: Object.entries(files).map(([file, tests]) => ({
    title: file,
    file,
    specs: [],
    suites: [{ title: "group", file, specs: tests.map((tries, i) => ({ title: `case ${i}`, file, tests: [{ projectName: "desktop", results: tries.map((duration) => ({ duration })) }] })) }],
  })),
});

test("caseCounts counts each file's cases and leaves the setup files out", () => {
  assert.deepEqual(caseCounts(report({ "a.spec.ts": [[], []], "b.spec.ts": [[]], "seed.setup.ts": [[]] })), { "a.spec.ts": 2, "b.spec.ts": 1 });
});

test("fileSeconds adds every try of every case, across reports", () => {
  const one = report({ "a.spec.ts": [[1000, 2000]], "b.spec.ts": [[400]] });
  const two = report({ "a.spec.ts": [[3000]] });
  assert.deepEqual(fileSeconds([one, two]), { "a.spec.ts": 6, "b.spec.ts": 0 });
});

test("plan splits by time, not by count: the slow file runs alone", () => {
  const counts = { "slow.spec.ts": 2, "a.spec.ts": 2, "b.spec.ts": 2, "c.spec.ts": 2 };
  const durations = { "slow.spec.ts": 90, "a.spec.ts": 30, "b.spec.ts": 30, "c.spec.ts": 30 };
  assert.deepEqual(plan(counts, durations, 2), [["slow.spec.ts"], ["a.spec.ts", "b.spec.ts", "c.spec.ts"]]);
});

test("plan prices a file it has no time for at the median seconds per case", () => {
  // 10 s a case: the new file's 6 cases weigh 60 s, as much as the two known files together.
  const counts = { "a.spec.ts": 3, "b.spec.ts": 3, "new.spec.ts": 6 };
  const durations = { "a.spec.ts": 30, "b.spec.ts": 30 };
  assert.deepEqual(plan(counts, durations, 2), [["new.spec.ts"], ["a.spec.ts", "b.spec.ts"]]);
});

test("plan gives every file exactly once, and the same split for the same inputs", () => {
  const counts = Object.fromEntries(Array.from({ length: 23 }, (_, i) => [`f${i}.spec.ts`, 1 + (i % 4)]));
  const durations = Object.fromEntries(Object.keys(counts).map((f, i) => [f, 5 + ((i * 7) % 40)]));
  const split = plan(counts, durations, 4);
  assert.deepEqual(split.flat().sort(), Object.keys(counts).sort());
  assert.deepEqual(plan(counts, durations, 4), split);
});

test("pattern matches its file and not one whose name ends the same", () => {
  // As Playwright reads a file argument: a regular expression searched in the path.
  const re = new RegExp(pattern("people.spec.ts"), "i");
  assert.ok(re.test("/repo/shell/e2e/people.spec.ts"));
  assert.ok(!re.test("/repo/shell/e2e/peek-people.spec.ts"));
  assert.ok(!re.test("/repo/shell/e2e/peopleXspec.ts"));
});

test("matrix numbers the runners and drops one left with nothing to run", () => {
  assert.deepEqual(matrix({ "a.spec.ts": 1 }, { "a.spec.ts": 5 }, 4), { include: [{ shard: 1, files: "/a\\.spec\\.ts$" }] });
});
