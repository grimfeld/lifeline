// node --test scripts/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNew } from "./worktrees.mjs";

test("new takes origin/master as its base by default", () => assert.deepEqual(parseNew(["x"]), { name: "x", base: "origin/master" }));
test("--base names another ref, before or after the name", () => {
  assert.deepEqual(parseNew(["x", "--base", "integration/1"]), { name: "x", base: "integration/1" });
  assert.deepEqual(parseNew(["--base", "b", "x"]), { name: "x", base: "b" });
});
test("--base without a ref is refused", () => assert.equal(parseNew(["x", "--base"]).base, undefined));
