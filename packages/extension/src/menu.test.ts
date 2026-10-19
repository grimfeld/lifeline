import { describe, expect, it } from "vitest";
import { fetchIntakes, intakeOfMenuItem, menuEntries, type IntakesCache } from "./menu";

const LIST = [
  { key: "tasks/task", title: "Task" },
  { key: "commonplace/quote", title: "Quote" },
];

describe("the context menu", () => {
  it("is plain Send to Lifeline when there are no Intakes to name", () => {
    expect(menuEntries(null)).toEqual([{ id: "send", title: "Send to Lifeline" }]);
    expect(menuEntries([])).toEqual([{ id: "send", title: "Send to Lifeline" }]);
  });

  it("is Send to Lifeline › a plain send, then one entry per Intake, in the list's order", () => {
    const entries = menuEntries(LIST);
    expect(entries[0]).toEqual({ id: "send", title: "Send to Lifeline" });
    const under = entries.filter((e) => e.parentId === "send" && e.type !== "separator");
    expect(under.map((e) => [e.title, intakeOfMenuItem(e.id)])).toEqual([
      ["Choose in Lifeline…", undefined],
      ["Task", "tasks/task"],
      ["Quote", "commonplace/quote"],
    ]);
  });

  it("names the Intake of the entry chosen, and none for a plain send", () => {
    expect(intakeOfMenuItem("send")).toBeUndefined();
    expect(intakeOfMenuItem(menuEntries(LIST).find((e) => e.title === "Quote")!.id)).toBe("commonplace/quote");
  });
});

/** An in-memory cache, as storage.local holds it. */
function memory(): IntakesCache & { saved?: unknown } {
  const cache: IntakesCache & { saved?: unknown } = {
    get: async () => cache.saved as never,
    set: async (value) => void (cache.saved = value),
  };
  return cache;
}
const answering = (body: unknown, status = 200) => async (url: string) => ({ url, ok: status === 200, status, json: async () => body });
const failing = async () => {
  throw new TypeError("Failed to fetch");
};

describe("the Intakes the menu names", () => {
  it("are fetched from the Lifeline's published list, and kept", async () => {
    const cache = memory();
    const seen: string[] = [];
    const fetch = async (url: string) => (seen.push(url), answering({ intakes: LIST })(url));
    expect(await fetchIntakes("https://lifeline.example", { fetch, cache })).toEqual(LIST);
    expect(seen).toEqual(["https://lifeline.example/intakes.json"]);
    // Unreachable later: the kept list still names them.
    expect(await fetchIntakes("https://lifeline.example", { fetch: failing, cache })).toEqual(LIST);
  });

  it("are the kept list when the Lifeline answers with something else", async () => {
    const cache = memory();
    await fetchIntakes("https://lifeline.example", { fetch: answering({ intakes: LIST }), cache });
    expect(await fetchIntakes("https://lifeline.example", { fetch: answering("<!doctype html>", 404), cache })).toEqual(LIST);
    expect(await fetchIntakes("https://lifeline.example", { fetch: answering({ nope: 1 }), cache })).toEqual(LIST);
  });

  it("are none when the list cannot be fetched and nothing is kept", async () => {
    expect(await fetchIntakes("https://lifeline.example", { fetch: failing, cache: memory() })).toBeNull();
    expect(await fetchIntakes("https://lifeline.example", { fetch: answering({}, 500), cache: memory() })).toBeNull();
  });

  it("are not another Lifeline's kept list", async () => {
    const cache = memory();
    await fetchIntakes("https://lifeline.example", { fetch: answering({ intakes: LIST }), cache });
    expect(await fetchIntakes("https://mine.example", { fetch: failing, cache })).toBeNull();
  });
});
