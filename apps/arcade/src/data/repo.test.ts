import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { documentsTable, getDocument, initApps, patchDocument } from "@lifeline/core";
import { workTypeDefs } from "../types";
import type { Work } from "../domain/types";
import { addWork, normalize, patchWork } from "./repo";

initApps([{ id: "arcade", title: "Arcade", types: workTypeDefs, screens: [], cards: [], commands: [] }]);

const work = async (id: string) => normalize((await getDocument<Work>(id))!);

beforeEach(async () => {
  await documentsTable().clear();
});

describe("patchWork", () => {
  it("writes only the patched fields, never reverting what changed since the copy was read (CR-51)", async () => {
    const id = await addWork({ medium: "game", title: "Tetris", acquisition: "WANTED", reason: "" });
    const stale = await work(id);
    await patchDocument(id, { acquisition: "OWNED", reason: "a friend's pick" });
    await patchWork(stale, { year: 1984, coverUrl: "https://covers/x.jpg" });
    const now = await work(id);
    expect([now.year, now.coverUrl, now.acquisition, now.reason]).toEqual([1984, "https://covers/x.jpg", "OWNED", "a friend's pick"]);
  });
});
