import { describe, expect, it } from "vitest";
import { isDoneUrl, tabHandoff } from "./lifeline";

describe("isDoneUrl", () => {
  it("is the done address on the Lifeline", () => {
    expect(isDoneUrl("https://lifeline.example/handoff/done", "https://lifeline.example")).toBe(true);
    expect(isDoneUrl("https://lifeline.example/handoff/done?id=1", "https://lifeline.example")).toBe(true);
  });
  it("is not the Handoff page itself, nor the done address elsewhere", () => {
    expect(isDoneUrl("https://lifeline.example/handoff#v1.x", "https://lifeline.example")).toBe(false);
    expect(isDoneUrl("https://lifeline.example/handoff/doneish", "https://lifeline.example")).toBe(false);
    expect(isDoneUrl("https://evil.example/handoff/done", "https://lifeline.example")).toBe(false);
    expect(isDoneUrl(undefined, "https://lifeline.example")).toBe(false);
  });
});

describe("tabHandoff", () => {
  it("is the tab's title and URL, with no text, for a page the extension cannot script", () => {
    expect(tabHandoff({ title: "Extensions", url: "chrome://extensions/" })).toEqual({ title: "Extensions", text: "", url: "chrome://extensions/" });
    expect(tabHandoff({})).toEqual({ title: "", text: "" });
  });
});
