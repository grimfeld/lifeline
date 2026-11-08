import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { buildLinkIndex, documentsOf, documentsTable, getDocument, moveDocumentsToWorkspace, removeDocument, initApps } from "@lifeline/core";
import { personTypeDef, tieTypeDef } from "../types";
import { addPerson } from "./repo";
import { addTie, tiesOf, updateTie, removeTie } from "./ties";

initApps([{ id: "contacts", title: "Contacts", module: "people", types: [personTypeDef, tieTypeDef], screens: [], cards: [], commands: [] }]);

beforeEach(async () => {
  await documentsTable().clear();
});

async function pair() {
  const anne = await addPerson({ name: "Anne" });
  const lea = await addPerson({ name: "Léa" });
  return { anne, lea };
}

describe("Ties (#412)", () => {
  it("is stored once and read from both ends", async () => {
    const { anne, lea } = await pair();
    await addTie({ from: anne.id, to: lea.id, label: "mother", toLabel: "daughter" });
    expect(await documentsOf("contacts_tie")).toHaveLength(1);
    expect((await tiesOf(anne.id)).map((t) => t.labelA)).toEqual(["mother"]);
    expect(await tiesOf(lea.id)).toHaveLength(1);
  });

  it("is edited from either end and removed whole", async () => {
    const { anne, lea } = await pair();
    const t = await addTie({ from: anne.id, to: lea.id, label: "mother", toLabel: "daughter" });
    // On Léa's page: Anne is her "mum", she is Anne's "girl".
    await updateTie(t.id, lea.id, { label: "mum", ownLabel: "girl" });
    expect(await getDocument(t.id)).toMatchObject({ labelA: "mum", labelB: "girl" });
    await updateTie(t.id, anne.id, { label: "daughter", ownLabel: "mother" });
    expect(await getDocument(t.id)).toMatchObject({ labelA: "mother", labelB: "daughter" });
    await removeTie(t.id);
    expect(await tiesOf(anne.id)).toEqual([]);
  });

  it("refuses a Tie to oneself, to a non-Person, or with no word", async () => {
    const { anne, lea } = await pair();
    await expect(addTie({ from: anne.id, to: anne.id, label: "x", toLabel: "y" })).rejects.toThrow("themselves");
    await expect(addTie({ from: anne.id, to: "nobody", label: "x", toLabel: "y" })).rejects.toThrow("two People");
    await expect(addTie({ from: anne.id, to: lea.id, label: " ", toLabel: "y" })).rejects.toThrow("word");
  });

  it("goes when either Person is deleted, leaving the other's page whole", async () => {
    const { anne, lea } = await pair();
    await addTie({ from: anne.id, to: lea.id, label: "mother", toLabel: "daughter" });
    await removeDocument(anne.id);
    expect(await tiesOf(lea.id)).toEqual([]);
    expect(await getDocument(lea.id)).toBeDefined();
  });

  it("moves with its People between Workspaces", async () => {
    const { anne, lea } = await pair();
    const t = await addTie({ from: anne.id, to: lea.id, label: "mother", toLabel: "daughter" });
    await moveDocumentsToWorkspace([anne.id], "ws2");
    expect((await documentsTable().get(t.id))?.workspace).toBe("ws2");
  });

  it("is no Backlink and no Report source for either Person", async () => {
    const { anne, lea } = await pair();
    await addTie({ from: anne.id, to: lea.id, label: "mother", toLabel: "daughter" });
    const docs = await documentsOf("contacts_tie").then(async (ties) => [...ties, ...(await documentsOf("contacts_person"))]);
    const index = buildLinkIndex(docs, [personTypeDef, tieTypeDef]);
    expect(index.backlinksTo(lea.id)).toEqual([]);
    expect(index.backlinksTo(anne.id)).toEqual([]);
  });
});
