import { describe, expect, it } from "vitest";
import {
  addOption,
  fieldsFromDrafts,
  fieldSummary,
  hasFieldSettings,
  hasFoldOut,
  newFieldDraft,
  optionValueFrom,
  rekeyField,
  relabelField,
  removeOption,
  renameOption,
  toFieldDrafts,
  type FieldDraft,
  type LinkTarget,
} from "./fieldDrafts";
import type { FieldDef } from "./types";

const roundTrip = (fields: FieldDef[]) => fieldsFromDrafts(toFieldDrafts(fields));

describe("Field drafts round-trip", () => {
  it("keeps a Link restricted to several types", () => {
    const fields: FieldDef[] = [{ key: "met", label: "Met at", kind: "link", linkType: ["place", "event"] }];
    expect(roundTrip(fields)).toEqual(fields);
  });

  it("keeps a Link restricted to a Role", () => {
    const fields: FieldDef[] = [{ key: "favourite", label: "Favourite author", kind: "links", linkRole: "author" }];
    expect(roundTrip(fields)).toEqual(fields);
  });

  it("is identity for every FieldDef the store can hold", () => {
    const fields: FieldDef[] = [
      { key: "born", label: "Born", kind: "date", required: true, column: false },
      { key: "ref", label: "Ref", kind: "text", guarded: true, hidden: true },
      { key: "home", label: "Home", kind: "link", linkType: "place" },
      { key: "one", label: "One", kind: "link", linkType: ["place"] },
      { key: "both", label: "Both", kind: "links", linkRole: "author", linkType: "person" },
      { key: "any", label: "Any", kind: "link" },
      { key: "mood", label: "Mood", kind: "select", options: [{ value: "home", label: "At home" }, { value: "out", label: "out" }] },
      { key: "tags2", label: "Tags", kind: "multiselect", options: [] },
      { key: "open", label: "Open", kind: "select" },
      { key: "aliases", label: "Aliases", kind: "list" },
      { key: "where", label: "Where", kind: "geo" },
      { key: "schedule", label: "Schedule", kind: "json" },
    ];
    expect(roundTrip(fields)).toEqual(fields);
  });
});

describe("Field drafts being edited", () => {
  it("derives a new Field's key from what was typed, and keeps a saved one's", () => {
    const [saved] = toFieldDrafts([{ key: "Odd Key", label: "Odd", kind: "text" }]);
    expect(fieldsFromDrafts([{ ...newFieldDraft(), key: "Met at", label: "Met at" }, { ...saved, label: "Renamed" }])).toEqual([
      { key: "met_at", label: "Met at", kind: "text" },
      { key: "Odd Key", label: "Renamed", kind: "text" },
    ]);
  });

  it("leaves out a draft with no key yet, and labels a Field by its key when the label is empty", () => {
    expect(fieldsFromDrafts([newFieldDraft(), { ...newFieldDraft(), key: "nick" }])).toEqual([{ key: "nick", label: "nick", kind: "text" }]);
  });

  it("maps a Link target onto linkType and linkRole", () => {
    const link = (target: LinkTarget) => fieldsFromDrafts([{ ...newFieldDraft("link"), key: "to", label: "To", target }])[0];
    expect(link({ to: "any" })).toEqual({ key: "to", label: "To", kind: "link" });
    expect(link({ to: "types", types: ["person"] })).toEqual({ key: "to", label: "To", kind: "link", linkType: "person" });
    expect(link({ to: "types", types: ["person", "place"] })).toEqual({ key: "to", label: "To", kind: "link", linkType: ["person", "place"] });
    expect(link({ to: "role", role: "author" })).toEqual({ key: "to", label: "To", kind: "link", linkRole: "author" });
  });

  it("drops a Link's restriction when it is retargeted or stops being a Link", () => {
    const [d] = toFieldDrafts([{ key: "to", label: "To", kind: "link", linkRole: "author", linkType: "person" }]);
    expect(fieldsFromDrafts([{ ...d, target: { to: "types", types: ["work"] } }])).toEqual([{ key: "to", label: "To", kind: "link", linkType: "work" }]);
    expect(fieldsFromDrafts([{ ...d, kind: "text" }])).toEqual([{ key: "to", label: "To", kind: "text" }]);
  });

  it("drops a Choice's options when it stops being a Choice", () => {
    const [d] = toFieldDrafts([{ key: "mood", label: "Mood", kind: "select", options: [{ value: "a", label: "A" }] }]);
    expect(fieldsFromDrafts([{ ...d, kind: "multiselect" }])[0].options).toEqual([{ value: "a", label: "A" }]);
    expect(fieldsFromDrafts([{ ...d, kind: "text" }])).toEqual([{ key: "mood", label: "Mood", kind: "text" }]);
  });
});

describe("Choice options", () => {
  it("derives an added option's value from its label, unique within the Field", () => {
    expect(optionValueFrom("Eating out")).toBe("eating_out");
    expect(optionValueFrom("Eating out", ["eating_out"])).toBe("eating_out_2");
  });

  it("keeps a saved option's value when it is relabelled", () => {
    const [d] = toFieldDrafts([{ key: "mood", label: "Mood", kind: "select", options: [{ value: "home", label: "Home" }] }]);
    const relabelled = { ...d, options: d.options.map((o) => ({ ...o, label: "At home" })) };
    expect(fieldsFromDrafts([relabelled])[0].options).toEqual([{ value: "home", label: "At home" }]);
  });

  const mood = () => toFieldDrafts([{ key: "mood", label: "Mood", kind: "select", options: [{ value: "home", label: "Home" }] }])[0];
  const saved = (d: FieldDraft) => fieldsFromDrafts([d])[0].options;

  it("adds an option whose value follows its label until saved", () => {
    const d = renameOption(addOption(mood()), 1, "Eating out");
    expect(saved(d)).toEqual([{ value: "home", label: "Home" }, { value: "eating_out", label: "Eating out" }]);
    expect(saved(renameOption(addOption(mood(), "Home"), 1, "Home"))).toEqual([{ value: "home", label: "Home" }, { value: "home_2", label: "Home" }]);
  });

  it("renames a saved option's label only", () => {
    expect(saved(renameOption(mood(), 0, "At home"))).toEqual([{ value: "home", label: "At home" }]);
  });

  it("removes an option, and leaves out one with no label yet", () => {
    expect(saved(removeOption(addOption(mood(), "Out"), 0))).toEqual([{ value: "out", label: "Out" }]);
    expect(saved(addOption(mood()))).toEqual([{ value: "home", label: "Home" }]);
  });
});

describe("A Field's key", () => {
  it("follows a new Field's label", () => {
    const d = relabelField(relabelField(newFieldDraft(), "Met"), "Met at");
    expect(d.key).toBe("met_at");
    expect(d.label).toBe("Met at");
  });

  it("stops following once typed by hand, and can be typed until saved", () => {
    const d = relabelField(rekeyField(relabelField(newFieldDraft(), "Met"), "where"), "Met at");
    expect(d.key).toBe("where");
    const [saved] = toFieldDrafts([{ key: "met", label: "Met", kind: "text" }]);
    expect(rekeyField(saved, "other").key).toBe("met");
    expect(relabelField(saved, "Met at").key).toBe("met");
  });

  it("is locked on a Known field, saved or not: its label is renamed, its key stays (ADR 0078)", () => {
    const d = relabelField(newFieldDraft("list", "Aliases"), "Also known as", true);
    expect([d.key, d.label]).toEqual(["aliases", "Also known as"]);
  });
});

describe("A folded Field row", () => {
  const names = { typeLabel: (id: string) => ({ person: "Person", place: "Place" })[id] ?? id, roleLabel: (id: string) => (id === "author" ? "Author" : id) };

  it("has settings only for Choice, Multi-choice, Link and Links", () => {
    expect((["select", "multiselect", "link", "links", "text", "list", "geo"] as const).map((k) => hasFieldSettings(k))).toEqual([true, true, true, true, false, false, false]);
  });

  it("has a fold-out while unsaved, whatever its kind, so its key can be edited", () => {
    expect(hasFoldOut(newFieldDraft("text", "Tags"))).toBe(true);
    const [text, choice] = toFieldDrafts([{ key: "met", label: "Met", kind: "text" }, { key: "mood", label: "Mood", kind: "select" }]);
    expect(hasFoldOut(text)).toBe(false);
    expect(hasFoldOut(choice)).toBe(true);
  });

  it("has no fold-out on a Known field — its key and kind are locked (ADR 0078)", () => {
    expect(hasFoldOut(newFieldDraft("list", "Aliases"), true)).toBe(false);
  });

  it("sums up a Choice's options and a Link's target", () => {
    const opts = (n: number) => Array.from({ length: n }, (_, i) => ({ value: `v${i}`, label: `V${i}`, saved: false }));
    expect(fieldSummary({ ...newFieldDraft("select"), options: opts(3) }, names)).toBe("3 options");
    expect(fieldSummary({ ...newFieldDraft("multiselect"), options: opts(1) }, names)).toBe("1 option");
    expect(fieldSummary(newFieldDraft("select"), names)).toBe("No options");
    expect(fieldSummary(newFieldDraft("link"), names)).toBe("→ Any type");
    expect(fieldSummary({ ...newFieldDraft("links"), target: { to: "types", types: ["person", "place"] } }, names)).toBe("→ Person, Place");
    expect(fieldSummary({ ...newFieldDraft("link"), target: { to: "role", role: "author" } }, names)).toBe("→ Author (Role)");
    expect(fieldSummary(newFieldDraft("text"), names)).toBe("");
  });
});
