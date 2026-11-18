// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { fill, peekNew, peekTests, press, stored } from "@lifeline/parts/testing";
import { pricesApp } from "../index";

/** The Prices App's Peeks write their own Fields through its operations (ADR 0085). */
peekTests([pricesApp]);

it("a Receipt's branch is edited in its Peek", async () => {
  const ids = await peekNew({ type: "price_shop", title: "Corner shop", note: "" }, { type: "price_receipt", shopId: "$0", date: "2026-10-01", branch: "", total: 0 });
  await fill("Branch", "Centre");
  await press("Branch", "Enter");
  expect(await stored(ids[1]!, "branch")).toBe("Centre");
});
