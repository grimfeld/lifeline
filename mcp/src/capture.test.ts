import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { allDocuments, initApps, todayStr } from "@lifeline/core";
import { manifests } from "./apps";
import { runTool } from "./handlers";
import { TOOLS } from "./tools";

initApps(manifests);

describe("notes_capture", () => {
  it("is a write tool that takes the line to capture", () => {
    const tool = TOOLS.find((t) => t.name === "notes_capture");
    expect(tool?.write).toBe(true);
    expect(tool!.input.text.safeParse("the plumber came").success).toBe(true);
  });

  it("appends the line to today's Day, stamped with the time", async () => {
    const res = (await runTool("notes_capture", { text: "the plumber came" })) as { message: string; id: string };
    expect(res.message).toBe("Captured in today's journal");
    const day = (await allDocuments()).find((d) => d.id === res.id);
    expect(day?.title).toBe(todayStr());
    expect(day?.body).toMatch(/^- \d\d:\d\d the plumber came$/m);
  });
});
