// @vitest-environment jsdom
import { createRoot } from "react-dom/client";
import { act } from "react";
import { expect, it } from "vitest";
import { initApps } from "@lifeline/core";
import { MemoryForm } from "./MemoryForm";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
initApps([]);

async function render(showAbout: boolean) {
  const host = document.createElement("div");
  document.body.append(host);
  await act(async () => {
    createRoot(host).render(<MemoryForm value={{ title: "Lunch", date: "2026-06-14", about: [] }} onChange={() => {}} showAbout={showAbout} />);
  });
  return host.textContent ?? "";
}

it("adding asks for a title and a date; editing adds About", async () => {
  const adding = await render(false);
  expect(adding).toContain("Title");
  expect(adding).toContain("Date");
  expect(adding).not.toContain("About");
  expect(await render(true)).toContain("About");
});
