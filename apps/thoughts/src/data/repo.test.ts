import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { documentsTable, initApps } from "@lifeline/core";
import { thoughtTypeDef } from "../types";
import { THOUGHTS_FOLDER } from "../domain/types";
import { captureThought } from "./repo";

initApps([{ id: "thoughts", title: "Thoughts", types: [thoughtTypeDef], screens: [], cards: [], commands: [] }]);

beforeEach(async () => {
  await documentsTable().clear();
});

describe("capturing a Thought (ADR 0068)", () => {
  it("keeps the text as its body, its first line as its title, in the Thoughts folder", async () => {
    const t = await captureThought({ text: "# Gardens\nare slow arguments  \n", kind: "idea", tags: ["Garden"] });
    expect(t).toMatchObject({ title: "Gardens", body: "# Gardens\nare slow arguments\n", folder: THOUGHTS_FOLDER, kind: "idea", tags: ["garden"] });
  });

  it("takes a given title over the first line", async () => {
    expect((await captureThought({ text: "body", title: " Named " })).title).toBe("Named");
  });

  it("numbers a repeated first line rather than failing", async () => {
    await captureThought({ text: "Again" });
    await captureThought({ text: "again" });
    expect((await captureThought({ text: "Again" })).title).toBe("Again (3)");
  });

  it("refuses an empty Thought", async () => {
    await expect(captureThought({ text: " \n " })).rejects.toThrow("needs some text");
  });
});
