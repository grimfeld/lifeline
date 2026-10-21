// node --test scripts/*.test.mjs (part of `pnpm check`).
import { test } from "node:test";
import assert from "node:assert/strict";
import { batchOf, isGreen, toRenumber } from "./integrate.mjs";

const run = (conclusion, status = "COMPLETED") => ({ __typename: "CheckRun", status, conclusion });
const pr = (number, over = {}) => ({ number, baseRefName: "master", isDraft: false, headRefName: `branch-${number}`, createdAt: `2026-10-${10 + number}T00:00:00Z`, statusCheckRollup: [run("SUCCESS")], ...over });

test("green means every check finished without failing, skipped and neutral included", () => {
  assert.equal(isGreen(pr(1, { statusCheckRollup: [run("SUCCESS"), run("SKIPPED"), run("NEUTRAL")] })), true);
  assert.equal(isGreen(pr(1, { statusCheckRollup: [{ __typename: "StatusContext", state: "SUCCESS" }] })), true);
});

test("a failed, cancelled or running check, or none at all, is not green", () => {
  assert.equal(isGreen(pr(1, { statusCheckRollup: [run("SUCCESS"), run("FAILURE")] })), false);
  assert.equal(isGreen(pr(1, { statusCheckRollup: [run("CANCELLED")] })), false);
  assert.equal(isGreen(pr(1, { statusCheckRollup: [run(null, "IN_PROGRESS")] })), false);
  assert.equal(isGreen(pr(1, { statusCheckRollup: [] })), false);
});

test("a bare batch takes the green PRs on master, oldest first, and leaves out drafts and integration branches", () => {
  const prs = [
    pr(3),
    pr(1),
    pr(2, { isDraft: true }),
    pr(4, { baseRefName: "other" }),
    pr(5, { headRefName: "integration/2026-10-21" }),
    pr(6, { statusCheckRollup: [run("FAILURE")] }),
  ];
  assert.deepEqual(batchOf(prs), [1, 3]);
});

test("a migration is renumbered when another file holds its number", () => {
  const all = ["1760000000_a.js", "1760000000_b.js", "1760100000_c.js"];
  assert.deepEqual(toRenumber(["1760000000_b.js"], all, "1759900000_x.js"), ["1760000000_b.js"]);
});

test("a migration is renumbered when it sorts before master's newest", () => {
  assert.deepEqual(toRenumber(["1759800000_b.js"], ["1759800000_b.js", "1759900000_x.js"], "1759900000_x.js"), ["1759800000_b.js"]);
});

test("a migration with a number of its own after master's newest stays", () => {
  assert.deepEqual(toRenumber(["1760000000_b.js"], ["1759900000_x.js", "1760000000_b.js"], "1759900000_x.js"), []);
});
