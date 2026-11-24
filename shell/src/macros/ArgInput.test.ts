// @vitest-environment jsdom
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { PERSON_TYPE, type CommandArg } from "@lifeline/core";
import { ArgInput } from "./ArgInput";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function draw(arg: CommandArg): Promise<string> {
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(createElement(ArgInput, { arg, value: undefined, onChange: () => {} })));
  const html = host.innerHTML;
  await act(async () => root.unmount());
  return html;
}

describe("a list of links in the Macro editor", () => {
  it("is a People field for People and a Links field for any other list (a Memory's About)", async () => {
    const people = await draw({ key: "with", label: "With", kind: "links", linkType: PERSON_TYPE });
    const about = await draw({ key: "about", label: "About", kind: "links" });
    expect(people).toContain("Add a person…");
    expect(about).not.toContain("Add a person…");
    expect(about).toContain("About");
  });
});
