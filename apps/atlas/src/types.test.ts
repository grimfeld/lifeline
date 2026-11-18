import { describe, expect, it } from "vitest";
import { buildLinkIndex, type Document, type DocumentTypeDef } from "@lifeline/core";
import { placeTypeDef } from "./types";

const place = (id: string, title: string, more: Record<string, unknown> = {}): Document => ({ id, type: "atlas_place", title, aliases: [], kind: "", body: "", folder: "Places", tags: [], createdAt: "2026-01-01", updatedAt: "", deleted: 0, ...more });
// A user's own Shop type, as Prices' Shop would be: "Lidl" the chain beside "Lidl Prado" the Place.
const shopType: DocumentTypeDef = { id: "shop", label: "Shops", titleRule: "name", body: "optional", linkable: true, fields: [], builtIn: false };
const janou = place("p1", "Chez Janou", { aliases: ["Janou"], kind: "restaurant" });
const prado = place("p2", "Lidl Prado", { kind: "shop" });
const lidl: Document = { id: "s1", type: "shop", title: "Lidl", body: "", folder: "", tags: [], createdAt: "2026-01-01", updatedAt: "", deleted: 0 };
const day: Document = { id: "d1", type: "daily", title: "2026-11-14", body: "Lunch at [[Chez Janou]], then [[place:Lidl Prado]] and coffee near [[Janou]]. Chez Janou again soon.", folder: "", tags: [], createdAt: "2026-11-14", updatedAt: "", deleted: 0 };
const dailyType: DocumentTypeDef = { id: "daily", label: "Days", titleRule: "date", body: "required", fields: [], linkable: false, builtIn: true };

describe("a Place as a link target (ADR 0128)", () => {
  const index = buildLinkIndex([janou, prado, lidl, day], [placeTypeDef, shopType, dailyType]);

  it("is reached by its name, by the place: prefix and by an alias", () => {
    expect(index.resolve("Chez Janou")).toMatchObject({ kind: "doc", id: "p1" });
    expect(index.resolve("place:Lidl Prado")).toMatchObject({ kind: "doc", id: "p2" });
    expect(index.resolve("Janou")).toMatchObject({ kind: "doc", id: "p1" });
  });

  it("shows in the completer as a Place with its Kind, told apart from a Shop", () => {
    const names = index.names();
    expect(names.find((n) => n.name === "Chez Janou")?.subtitle).toBe("Place · Restaurant");
    expect(names.find((n) => n.name === "Lidl Prado")?.subtitle).toBe("Place · Shop");
    expect(names.find((n) => n.name === "Lidl")?.subtitle).not.toMatch(/Place/);
  });

  it("has the Day for a backlink, once per link that names it", () => {
    expect(index.backlinksTo("p1").map((b) => b.sourceId)).toEqual(["d1", "d1"]);
    expect(index.backlinksTo("p2").map((b) => b.sourceId)).toEqual(["d1"]);
  });
});
