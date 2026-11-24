import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { NARROW_BELOW } from "@lifeline/ui";

// The kit's `cq-` variants (globals.css) and its `useNarrow()` hook draw the same
// line (ADR 0133); the kit has no Node types to read its own CSS, so the shell does.
const css = readFileSync(fileURLToPath(new URL("../../packages/ui/src/styles/globals.css", import.meta.url)), "utf8");
const variant = (name: string) => new RegExp(`@custom-variant ${name} \\{ @container content \\(width ([<>]=?) ([\\d.]+)rem\\)`).exec(css)?.slice(1);

describe("the cq- variants", () => {
  it("query the content container at the same line as useNarrow()", () => {
    expect(variant("cq-md")).toEqual([">=", String(NARROW_BELOW / 16)]);
    expect(variant("cq-max-md")).toEqual(["<", String(NARROW_BELOW / 16)]);
  });

  it("measure <body> outside every page container, so portalled content reads the viewport", () => {
    expect(css).toMatch(/body \{\s*container: content \/ inline-size;/);
  });
});
