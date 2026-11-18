// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { choose, click, control, peekNew, peekTests, stored } from "@lifeline/parts/testing";
import { manuscriptApp } from "../index";

/** The Manuscript's Peeks write their own Fields; a Chapter's order moves only through the App (ADR 0085). */
peekTests([manuscriptApp]);

it("a Chapter's status is set and its order moved through the App, in its Peek", async () => {
  const ids = await peekNew(
    { type: "manuscript", title: "A novel", form: "novel", status: "draft" },
    { type: "chapter", title: "One", manuscriptId: "$0", position: 1, status: "draft" },
    { type: "chapter", title: "Two", manuscriptId: "$0", position: 2, status: "draft" },
  );
  await choose("Status", "Done");
  expect(await stored(ids[2]!, "status")).toBe("done");
  await click(control("Earlier", "button"));
  expect(Number(await stored(ids[2]!, "position"))).toBeLessThan(Number(await stored(ids[1]!, "position")));
});
