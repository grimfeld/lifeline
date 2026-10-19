import { describe, expect, it } from "vitest";
import { buildLinkIndex } from "./documents/links";
import type { Document, DocumentTypeDef } from "./documents/types";
import { aliasWrite, buildSelectionMenu, linkTargets, writeLink, type SelectionMenuInput } from "./selectionMenu";

const T = (id: string, extra: Partial<DocumentTypeDef> = {}): DocumentTypeDef => ({
  id, label: id + "s", titleRule: "name", body: "optional", fields: [], linkable: true, builtIn: true, ...extra,
});
const doc = (id: string, type: string, title: string, extra: Record<string, unknown> = {}): Document => ({
  id, type, title, body: "", folder: "", tags: [], createdAt: "2026-01-01", updatedAt: "", deleted: 0, ...extra,
});

const MODULE_OF: Record<string, string | undefined> = { commonplace: "notes", tasks: "tasks", languages: "languages", shopping: "house", calendar: undefined };
const APP_TITLE: Record<string, string> = { commonplace: "Notes", tasks: "Tasks", languages: "Knowledge", shopping: "Shopping list", calendar: "Calendar" };

const intake = (appId: string, id: string, title: string) => ({ appId, id, key: `${appId}/${id}`, title });
// Registry order — deliberately not Module order.
const INTAKES = [
  intake("calendar", "event", "Event"),
  intake("commonplace", "quote", "Quote"),
  intake("languages", "word", "Word"),
  intake("languages", "sentence", "Sentence"),
  intake("shopping", "need", "Need"),
  intake("tasks", "task", "Task"),
];

const types = [T("person", { singular: "Person" }), T("note")];
const docs = [doc("p1", "person", "Marie Curie", { aliases: ["Marie"] }), doc("p2", "person", "Pierre"), doc("n1", "note", "Today")];

function menu(over: Partial<SelectionMenuInput<(typeof INTAKES)[number]>> = {}) {
  const text = over.text ?? "something";
  return buildSelectionMenu({
    text,
    // By default the selection is the one occurrence in a plain sentence, read from an editor.
    body: `Said ${text}.`,
    placement: { from: 5, to: 5 + text.length },
    originId: "n1",
    index: buildLinkIndex(docs, types),
    typeLabel: (id) => (id === "person" ? "Person" : id),
    intakes: INTAKES,
    moduleOf: (appId) => MODULE_OF[appId],
    appTitle: (appId) => APP_TITLE[appId],
    ...over,
  });
}
const shape = (groups: ReturnType<typeof menu>) => groups.map((g) => [g.title, g.entries.map((e) => e.title)]);

describe("the Selection menu's groups", () => {
  it("puts each Intake under its App's Module, an App in no Module first, the rest in Core's Module order", () => {
    expect(shape(menu())).toEqual([
      ["Link", ["Link to…"]],
      ["Calendar", ["Event"]],
      ["House", ["Need"]],
      ["Projects", ["Task"]],
      ["Notes", ["Quote"]],
      ["Knowledge", ["Word", "Sentence"]],
    ]);
  });

  it("lists the Module the user is in first among the Modules, the others keeping their places", () => {
    expect(shape(menu({ currentModule: "languages" })).map(([t]) => t)).toEqual(["Link", "Calendar", "Knowledge", "House", "Projects", "Notes"]);
  });
});

describe("Link", () => {
  /** The Link group's entry to the Document the text names, if any. */
  const named = (groups: ReturnType<typeof menu>) => groups.find((g) => g.id === "link")?.entries.filter((e) => e.kind === "link") ?? [];

  it("comes first when the text names a Document by its title", () => {
    const [first] = menu({ text: "Pierre" });
    expect(first.title).toBe("Link");
    expect(first.entries.slice(0, 1)).toMatchObject([{ kind: "link", title: "Link to Pierre (Person)", targetId: "p2", canonical: "Pierre" }]);
  });

  it("resolves an alias, case aside, and links to the title", () => {
    const [first] = menu({ text: "marie" });
    expect(first.entries.slice(0, 1)).toMatchObject([{ kind: "link", title: "Link to Marie Curie (Person)", targetId: "p1", canonical: "Marie Curie" }]);
  });

  it("is not offered when the text names nothing", () => {
    expect(named(menu({ text: "Marie Antoinette" }))).toEqual([]);
  });

  it("is not offered for the Document the text was selected in", () => {
    expect(named(menu({ text: "Today", originId: "n1" }))).toEqual([]);
  });

  it("is not offered when the selection cannot be linked where it is", () => {
    const inCode = "Run `Pierre` now";
    expect(named(menu({ text: "Pierre", body: inCode, placement: { from: 5, to: 11 } }))).toEqual([]);
    expect(named(menu({ text: "Pierre", body: "**Pi**erre and Pierre", placement: { text: "Pierre", occurrence: 1, count: 2 } }))).toEqual([]);
    expect(named(menu({ text: "Pierre", placement: null }))).toEqual([]);
  });

  it("is offered from a rendered body when the occurrence can be placed", () => {
    const [first] = menu({ text: "Pierre", body: "Pierre and Pierre", placement: { text: "Pierre", occurrence: 1, count: 2 } });
    expect(first.id).toBe("link");
  });

  it("writes the canonical path when the title is shared", () => {
    const shared = [doc("a", "person", "Alex", { folder: "Work" }), doc("b", "person", "Alex", { folder: "Home/Family" })];
    const [first] = menu({ text: "Alex", index: buildLinkIndex(shared, types), originId: "x" });
    expect(first.entries.slice(0, 1)).toMatchObject([{ targetId: "a", canonical: "Work/Alex" }]);
  });
});

describe("Link to…", () => {
  const linkGroup = (groups: ReturnType<typeof menu>) => groups.find((g) => g.id === "link");

  it("is offered in the Link group when the text names nothing, so any Document can be searched for", () => {
    expect(shape(menu({ text: "Marie Antoinette" }))[0]).toEqual(["Link", ["Link to…"]]);
    expect(linkGroup(menu({ text: "Marie Antoinette" }))?.entries).toMatchObject([{ kind: "search" }]);
  });

  it("follows the Document the text already names, for when it names the wrong one", () => {
    expect(shape(menu({ text: "Pierre" }))[0]).toEqual(["Link", ["Link to Pierre (Person)", "Link to…"]]);
  });

  it("is not offered when the selection cannot be linked where it is", () => {
    expect(linkGroup(menu({ text: "Pierre", body: "Run `Pierre` now", placement: { from: 5, to: 11 } }))).toBeUndefined();
    expect(linkGroup(menu({ text: "Pierre", placement: null }))).toBeUndefined();
  });

  it("is found by typing \"link\"", () => {
    expect(shape(menu({ query: "link" }))).toEqual([["Link", ["Link to…"]]]);
  });
});

describe("linkTargets: what Link to… searches", () => {
  const index = buildLinkIndex([...docs, doc("x1", "secret", "Hidden")], [...types, T("secret", { linkable: false })]);

  it("lists every Linkable Document once, by title, less the one the text was selected in", () => {
    expect(linkTargets(index, "n1", "").map((t) => t.title)).toEqual(["Marie Curie", "Pierre"]);
  });

  it("finds a Document by any part of its title or an alias, case aside", () => {
    expect(linkTargets(index, "n1", "CURIE").map((t) => t.id)).toEqual(["p1"]);
    expect(linkTargets(index, "n1", "mari").map((t) => t.id)).toEqual(["p1"]);
    expect(linkTargets(index, "n1", "zzz")).toEqual([]);
  });

  it("carries what to write in the link", () => {
    const shared = buildLinkIndex([doc("a", "person", "Alex", { folder: "Work" }), doc("b", "person", "Alex", { folder: "Home" })], types);
    expect(linkTargets(shared, "x", "")).toMatchObject([{ id: "a", canonical: "Work/Alex" }, { id: "b", canonical: "Home/Alex" }]);
  });
});

describe("aliasWrite: adding the selected words as an alias", () => {
  const person = T("person");
  const marie = doc("p1", "person", "Marie Curie", { aliases: ["Madame Curie"] });

  it("adds the words to the target's Aliases when they differ from its title", () => {
    expect(aliasWrite("Marie", marie, person)).toEqual({ key: "aliases", value: ["Madame Curie", "Marie"] });
  });

  it("starts the Aliases when the target has none", () => {
    expect(aliasWrite("Pierre", doc("p2", "person", "Pierre Curie"), person)).toEqual({ key: "aliases", value: ["Pierre"] });
  });

  it("is not offered when the words are the title or already an alias, case aside", () => {
    expect(aliasWrite("marie curie", marie, person)).toBeNull();
    expect(aliasWrite("madame  curie", marie, person)).toBeNull();
  });

  it("writes to the type's own aliases Field", () => {
    expect(aliasWrite("Marie", doc("p1", "person", "Marie Curie", { names: "Mme Curie" }), T("person", { linkable: { aliasesField: "names" } }))).toEqual({ key: "names", value: ["Mme Curie", "Marie"] });
  });
});

describe("typing filters the menu", () => {
  it("keeps the entries whose name holds what is typed, case aside, and drops empty groups", () => {
    expect(shape(menu({ query: "SEN" }))).toEqual([["Knowledge", ["Sentence"]]]);
  });

  it("keeps a whole group when its heading matches", () => {
    expect(shape(menu({ query: "know" }))).toEqual([["Knowledge", ["Word", "Sentence"]]]);
  });

  it("finds Link by its target's name", () => {
    expect(shape(menu({ text: "Pierre", query: "pier" }))).toEqual([["Link", ["Link to Pierre (Person)"]]]);
  });

  it("offers nothing when nothing matches, and everything when nothing is typed", () => {
    expect(menu({ query: "zzz" })).toEqual([]);
    expect(menu({ query: "  " })).toEqual(menu());
  });
});

describe("writeLink", () => {
  const at = (body: string, text: string, nth = 0) => {
    let from = -1;
    for (let i = 0; i <= nth; i++) from = body.indexOf(text, from + 1);
    return { from, to: from + text.length };
  };

  it("writes [[Title]] when the words are the title", () => {
    const body = "Met Pierre today.";
    expect(writeLink(body, at(body, "Pierre"), "Pierre")?.body).toBe("Met [[Pierre]] today.");
  });

  it("writes [[Title|words]] when the words differ, keeping them as written", () => {
    const body = "Saw marie at the lab.";
    expect(writeLink(body, at(body, "marie"), "Marie Curie")?.body).toBe("Saw [[Marie Curie|marie]] at the lab.");
  });

  it("says what changed, so an editor can apply it as one undoable edit", () => {
    const body = "Saw marie.";
    expect(writeLink(body, at(body, "marie"), "Marie Curie")).toEqual({ body: "Saw [[Marie Curie|marie]].", from: 4, to: 9, insert: "[[Marie Curie|marie]]" });
  });

  it.each([
    ["text inside a wikilink", "See [[Pierre]] again", "Pierre"],
    ["a piped wikilink's words", "See [[Pierre Curie|Pierre]] again", "Pierre"],
    ["text in inline code", "Run `Pierre` now", "Pierre"],
    ["text in a code block", "x\n```\nPierre\n```\n", "Pierre"],
    ["text in a URL", "At https://example.com/Pierre today", "Pierre"],
    ["text in frontmatter", "---\ntitle: Pierre\n---\nbody", "Pierre"],
    ["a span reaching into a link", "Pierre [[Marie]]", "Pierre [[Ma"],
    ["a span over two lines", "Pierre\nCurie", "Pierre\nCurie"],
  ])("never wraps %s",(_, body, text) => {
    expect(writeLink(body, at(body, text), "Pierre")).toBeNull();
  });

  describe("from a rendered body, by the occurrence selected", () => {
    it("wraps the occurrence at the selection's position", () => {
      const body = "Marie met Marie.";
      expect(writeLink(body, { text: "Marie", occurrence: 1, count: 2 }, "Marie")?.body).toBe("Marie met [[Marie]].");
      expect(writeLink(body, { text: "Marie", occurrence: 0, count: 2 }, "Marie")?.body).toBe("[[Marie]] met Marie.");
    });

    it("counts only plain prose, as the rendered page's own text does", () => {
      const body = "`Marie` and [[Marie]] and Marie";
      expect(writeLink(body, { text: "Marie", occurrence: 0, count: 1 }, "Marie")?.body).toBe("`Marie` and [[Marie]] and [[Marie]]");
    });

    it("cannot place it when the page and the body disagree on how often it occurs", () => {
      // Formatting splits the first one in the source; the page shows both.
      const body = "**Ma**rie and Marie";
      expect(writeLink(body, { text: "Marie", occurrence: 1, count: 2 }, "Marie")).toBeNull();
    });

    it("cannot place it when the occurrence is out of range", () => {
      expect(writeLink("Marie", { text: "Marie", occurrence: 1, count: 2 }, "Marie")).toBeNull();
      expect(writeLink("No one", { text: "Marie", occurrence: 0, count: 1 }, "Marie")).toBeNull();
    });
  });
});
