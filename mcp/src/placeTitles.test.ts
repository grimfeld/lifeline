import "fake-indexeddb/auto";
import { beforeAll, describe, expect, it } from "vitest";
import { PLACE_TYPE, createDocument, getDocument, initApps, putDocument } from "@lifeline/core";
import { manifests } from "./apps";
import { runTool } from "./handlers";

// Places' titles are unique in every folder (ADR 0119), over the real store, whatever tool renames one.
initApps(manifests);

let janou = "";
let other = "";
beforeAll(async () => {
  janou = (await createDocument({ type: PLACE_TYPE, title: "Chez Janou", folder: "Places" })).id;
  // A Place in another folder, as a Base or a move leaves one.
  other = (await putDocument({ type: PLACE_TYPE, title: "Le Fermé", folder: "Old places" })).id;
});

describe("update_document on a Place's title", () => {
  it("refuses a title another Place has in another folder, naming that Place and its id", async () => {
    await expect(runTool("update_document", { id: other, title: "chez janou" })).rejects.toThrow(`“chez janou” is already a Place: Chez Janou (id ${janou})`);
    expect((await getDocument(other)).title).toBe("Le Fermé");
  });

  it("moves a Place to another folder, its title still its own", async () => {
    expect(await runTool("update_document", { id: other, folder: "Places" })).toMatchObject({ message: "Updated folder" });
  });

  it("renames to a free title", async () => {
    expect(await runTool("update_document", { id: other, title: "Le Rouvert" })).toMatchObject({ message: "Updated title" });
  });
});
