import { describe, expect, it } from "vitest";
import { fieldsFromDrafts, newFieldDraft, optionsFromText, optionsText, optionValueFrom, toFieldDrafts, type LinkTarget } from "./fieldDrafts";
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

  it("reads and writes the editor's `value=Label` text unchanged", () => {
    const options = [{ value: "home", label: "Home" }, { value: "out", label: "Eating out" }];
    expect(optionsText(options)).toBe("home=Home, out=Eating out");
    expect(optionsText([{ value: "a", label: "a" }])).toBe("a");
    expect(optionsFromText("home=Home, out=Eating out ,, b").map(({ value, label }) => ({ value, label }))).toEqual([...options, { value: "b", label: "b" }]);
  });

  it("marks options already saved on the Field as saved", () => {
    const [d] = toFieldDrafts([{ key: "mood", label: "Mood", kind: "select", options: [{ value: "home", label: "Home" }] }]);
    expect(optionsFromText("home=Home, new", d.options).map((o) => o.saved)).toEqual([true, false]);
  });
});
