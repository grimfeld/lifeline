import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { getDocument, initApps, invokeCommand } from "@lifeline/core";
import { choresApp } from "./index";
import { choreCommands } from "./commands";

// Open the local database once with the Chores App's types (no sync started).
initApps([choresApp]);

describe("Add chore, headless", () => {
  it("returns the chore it made, so a Macro's later step can take it", async () => {
    const add = choreCommands.find((c) => c.id === "chores.add")!;
    expect(add.returnsDocument).toBe(true);
    const result = await invokeCommand(add, { title: "Water the plants", schedule: { kind: "weekly", weekdays: [6] } });
    expect(result.id).toBeDefined();
    expect((await getDocument(result.id!))?.title).toBe("Water the plants");
  });
});
