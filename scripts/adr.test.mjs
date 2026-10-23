// node --test scripts/*.test.mjs (part of `pnpm check`).
import { test } from "node:test";
import assert from "node:assert/strict";
import { cited, frontmatter, unanswered } from "./adr.mjs";

const adr = (fm, body = "# Title\n") => (fm ? `---\n${fm}\n---\n\n${body}` : body);

test("frontmatter reads key: value lines, CRLF included, and nothing without a block", () => {
  assert.deepEqual(frontmatter(adr("status: accepted\nsupersedes: ADR 0005")), { status: "accepted", supersedes: "ADR 0005" });
  assert.deepEqual(frontmatter("---\r\nstatus: accepted\r\n---\r\n\r\n# T\r\n"), { status: "accepted" });
  assert.deepEqual(frontmatter("# Title\n\nsupersedes: ADR 0005\n"), {});
});

test("a value cites each ADR it lists, and never one named inside a note", () => {
  assert.deepEqual(cited('ADR 0045 (in part — "the Vault writes"), ADR 0046 (in part — see ADR 0012)'), ["0045", "0046"]);
  assert.deepEqual(cited(undefined), []);
});

test("a supersedes answered by superseded-by, and an amends by amended-by, is no problem", () => {
  const texts = {
    "0001-old.md": adr("status: accepted\nsuperseded-by: ADR 0003 (in part — x)\namended-by: ADR 0002"),
    "0002-mid.md": adr("status: accepted\namends: ADR 0001"),
    "0003-new.md": adr("status: accepted\nsupersedes: ADR 0001 (in part — x)"),
  };
  assert.deepEqual(unanswered(texts), []);
});

test("a later ADR's supersedes that the earlier one does not answer names both files and the line to add", () => {
  const texts = { "0001-old.md": adr(null), "0002-new.md": adr("status: accepted\nsupersedes: ADR 0001") };
  assert.deepEqual(unanswered(texts), ["0002-new.md has `supersedes: ADR 0001`, but 0001-old.md does not answer: add `superseded-by: ADR 0002` to its frontmatter"]);
});

test("the check runs the other way too: an amended-by needs the later ADR's amends", () => {
  const texts = { "0001-old.md": adr("status: accepted\namended-by: ADR 0002"), "0002-new.md": adr("status: accepted\nsupersedes: ADR 0001") };
  assert.deepEqual(unanswered(texts), [
    "0001-old.md has `amended-by: ADR 0002`, but 0002-new.md does not answer: add `amends: ADR 0001` to its frontmatter",
    "0002-new.md has `supersedes: ADR 0001`, but 0001-old.md does not answer: add `superseded-by: ADR 0002` to its frontmatter",
  ]);
});

test("a key naming an ADR that does not exist is a problem", () => {
  assert.deepEqual(unanswered({ "0002-new.md": adr("status: accepted\namends: ADR 0009") }), ["0002-new.md has `amends: ADR 0009`, and there is no ADR 0009"]);
});
