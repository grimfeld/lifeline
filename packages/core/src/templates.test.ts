import { describe, expect, it } from "vitest";
import { renderTemplate } from "./templates";

describe("renderTemplate", () => {
  it("fills title/date/time and leaves unknown placeholders", () => {
    const out = renderTemplate("# {{title}}\n{{ date }} at {{time}} — {{nope}}", { title: "T", date: "2026-08-17", now: new Date(2026, 7, 17, 9, 5) });
    expect(out).toBe("# T\n2026-08-17 at 09:05 — {{nope}}");
  });
});
