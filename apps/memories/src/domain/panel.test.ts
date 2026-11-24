import { describe, expect, it } from "vitest";
import type { Document } from "@lifeline/core";
import { panelMemories } from "./panel";
import type { Memory } from "./types";

const mem = (id: string, date: string, about: string[] = []): Memory => ({ id, type: "memories_memory", title: id, body: "", date, about }) as unknown as Memory;
const memories = [mem("a", "2026-06-10"), mem("b", "2026-06-11", ["e1"]), mem("c", "2026-06-10", ["e1"])];
const doc = (type: string, title: string, id = "d1"): Document => ({ id, type, title }) as unknown as Document;

describe("panelMemories", () => {
  it("lists the Memories about an Event", () => expect(panelMemories(doc("event", "Wedding", "e1"), memories).map((m) => m.id)).toEqual(["b", "c"]));
  it("lists the Memories dated a Day, about anything or nothing", () => expect(panelMemories(doc("daily", "2026-06-10"), memories).map((m) => m.id)).toEqual(["a", "c"]));
  it("lists none for a Day with none dated it", () => expect(panelMemories(doc("daily", "2026-06-12"), memories)).toEqual([]));
  it("answers for no other type", () => expect(panelMemories(doc("task", "2026-06-10", "e1"), memories)).toEqual([]));
});
