// node --test scripts/*.test.mjs (part of `pnpm check`).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./cloud-git-email.mjs", import.meta.url));

function repo() {
  const dir = mkdtempSync(join(tmpdir(), "cloud-email-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "private@example.com"], { cwd: dir });
  return dir;
}
const email = (dir) => execFileSync("git", ["config", "user.email"], { cwd: dir, encoding: "utf8" }).trim();
const run = (dir, remote) => {
  const env = { ...process.env, CLAUDE_PROJECT_DIR: dir };
  delete env.CLAUDE_CODE_REMOTE;
  if (remote) env.CLAUDE_CODE_REMOTE = "true";
  execFileSync("node", [script], { env });
};

test("in a cloud session the agent email is set", () => {
  const dir = repo();
  run(dir, true);
  assert.equal(email(dir), "claude@grimfeld.tech");
});

test("in a local session the email is untouched", () => {
  const dir = repo();
  run(dir, false);
  assert.equal(email(dir), "private@example.com");
});

test("running it twice is harmless", () => {
  const dir = repo();
  run(dir, true);
  run(dir, true);
  assert.equal(email(dir), "claude@grimfeld.tech");
});
