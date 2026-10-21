import { describe, expect, it } from "vitest";
import { applySuggestion, readInlineLine, type InlineCommand, type InlineLineInput } from "./inline";

const ok = async () => ({ message: "done" });

const COMMANDS: InlineCommand[] = [
  {
    appId: "tasks",
    id: "tasks.add",
    title: "Add task",
    keywords: ["new", "todo", "task"],
    capture: true,
    dialog: () => null,
    args: [
      { key: "title", label: "Title", kind: "text", required: true },
      { key: "notes", label: "Notes", kind: "longtext" },
      { key: "estimate", label: "Estimate", kind: "number" },
      { key: "tags", label: "Tags", kind: "list" },
      { key: "project", label: "Project", kind: "link", linkType: "project" },
    ],
    invoke: ok,
  },
  { appId: "tasks", id: "tasks.complete", title: "Complete a task", keywords: ["done", "task"], dialog: () => null },
  { appId: "tasks", id: "tasks.week", title: "Plan the week", run: () => {} },
  {
    appId: "mood",
    id: "mood.set",
    title: "Set mood…",
    capture: true,
    dialog: () => null,
    args: [
      {
        key: "mood",
        label: "Mood",
        kind: "select",
        required: true,
        options: [
          { value: "great", label: "Great", keywords: ["super", "génial"] },
          { value: "bad", label: "Bad" },
          { value: "eating-out", label: "Eating out" },
        ],
      },
      { key: "note", label: "Note", kind: "text" },
    ],
    invoke: ok,
  },
  {
    appId: "commonplace",
    id: "commonplace.note-add",
    title: "Note on a source…",
    capture: true,
    args: [
      { key: "body", label: "Note", kind: "longtext", required: true },
      { key: "source", label: "Source", kind: "link", linkType: "source", required: true },
    ],
    invoke: ok,
  },
];

const DOCS = [
  { id: "d1", type: "source", title: "Dune" },
  { id: "d2", type: "film", title: "Dune" },
  { id: "d3", type: "source", title: "Mum's letters" },
  { id: "d4", type: "source", title: "Mum's letters" },
  { id: "p1", type: "project", title: "Family" },
];

function read(line: string, over: Partial<InlineLineInput> = {}) {
  return readInlineLine({ line, commands: COMMANDS, lookup: { tags: ["family", "work"], documents: DOCS }, ...over });
}

describe("the ! mark", () => {
  it("is not inline without a ! mark, so plain typing searches as before", () => {
    expect(read("call mum").inline).toBe(false);
    expect(read("Super !").inline).toBe(false);
  });

  it("suggests every Command after a bare !, and narrows as it is typed", () => {
    expect(read("!").suggestions.map((s) => s.label)).toHaveLength(COMMANDS.length);
    expect(read("!ta").suggestions[0].label).toBe("Add task");
    expect(read("!mo").suggestions.map((s) => s.label)).toEqual(["Set mood…"]);
  });

  it("picks the Command by a word of its name, anywhere in the line", () => {
    expect(read("!task call mum").command?.id).toBe("tasks.add");
    expect(read("call mum !task").command?.id).toBe("tasks.add");
    expect(read("call mum !task").args).toEqual({ title: "call mum" });
    expect(read("!mood #bad").command?.id).toBe("mood.set");
  });

  it("inserts a picked Command's name, which then reads back to it", () => {
    const s = read("call mum !ta", { cursor: 12 }).suggestions[0];
    const next = applySuggestion("call mum !ta", s);
    expect(next.line).toBe("call mum !add-task ");
    expect(read(next.line).command?.id).toBe("tasks.add");
  });

  it("reports a second ! Command instead of running", () => {
    const r = read("!task call mum !mood");
    expect(r.command?.id).toBe("tasks.add");
    expect(r.ready).toBe(false);
    expect(r.problems.join()).toMatch(/one Command/);
    expect(r.secondCommand).toBe(true);
    expect(read("!task call mum").secondCommand).toBe(false);
  });
});

describe("content", () => {
  it("fills the first text argument with the unmarked words", () => {
    expect(read("!task call mum about Sunday").args).toEqual({ title: "call mum about Sunday" });
  });

  it("reads quotes as content with no marks inside", () => {
    expect(read('!task "Buy #1 fan gift @home !now"').args).toEqual({ title: "Buy #1 fan gift @home !now" });
  });

  it("counts a mark only with a letter right after it", () => {
    expect(read("!task Super ! # @ #1").args).toEqual({ title: "Super ! # @ #1" });
  });

  it("leaves a URL alone", () => {
    const r = read("!task read https://example.com/a#b@c?x=1");
    expect(r.args).toEqual({ title: "read https://example.com/a#b@c?x=1" });
    expect(r.ready).toBe(true);
  });
});

describe("the # mark", () => {
  it("fills a select option by value, label or an App's keyword", () => {
    expect(read("!mood #bad").args).toEqual({ mood: "bad" });
    expect(read("!mood #Great").args).toEqual({ mood: "great" });
    expect(read("!mood #génial").args).toEqual({ mood: "great" });
    expect(read('!mood #"eating out"').args).toEqual({ mood: "eating-out" });
  });

  it("fills a Tag when no option fits, and reports a word that is neither", () => {
    expect(read("!task call mum #family #Work").args).toEqual({ title: "call mum", tags: ["family", "work"] });
    expect(read("!mood #meh").problems.join()).toMatch(/#meh/);
  });

  it("suggests the Command's options, then Tags in use", () => {
    expect(read("!mood #").suggestions.map((s) => s.insert)).toEqual(["#great", "#bad", "#eating-out"]);
    expect(read("!mood #su").suggestions.map((s) => s.label)).toEqual(["Great"]);
    expect(read("!task x #fa").suggestions.map((s) => s.insert)).toEqual(["#family"]);
  });
});

describe("the @ mark", () => {
  it("fills a link by exact title, among Documents of the type it expects", () => {
    expect(read("!note-on-a-source great opening @Dune").args).toEqual({ body: "great opening", source: "d1" });
    expect(read("!task plan @family").args).toEqual({ title: "plan", project: "p1" });
  });

  it("reports a title that names no Document, and leaves several to the dialog", () => {
    expect(read("!task plan @Dune").problems.join()).toMatch(/No project is called “Dune”/);
    const r = read("!note-on-a-source dear @\"Mum's letters\"");
    expect(r.ambiguous).toEqual([expect.objectContaining({ value: "Mum's letters", ids: ["d3", "d4"] })]);
    expect(r.ready).toBe(false);
  });

  it("suggests only Documents of the expected type, quoting a title with a space", () => {
    expect(read("!note-on-a-source x @").suggestions.map((s) => s.insert)).toEqual(["@Dune", '@"Mum\'s letters"', '@"Mum\'s letters"']);
    expect(read("!task x @").suggestions.map((s) => s.insert)).toEqual(["@Family"]);
  });
});

describe("the key: mark", () => {
  it("fills any argument by key or label, quotes holding spaces", () => {
    expect(read('!task call mum estimate:30 notes:"oat milk, not soy"').args).toEqual({ title: "call mum", estimate: "30", notes: "oat milk, not soy" });
    expect(read("!mood mood:bad note:tired").args).toEqual({ mood: "bad", note: "tired" });
    expect(read("!note-on-a-source source:Dune note:wow").args).toEqual({ source: "d1", body: "wow" });
  });

  it("stays content when the word names no argument", () => {
    expect(read("!task Remember: milk").args).toEqual({ title: "Remember: milk" });
  });

  it("suggests the arguments not given yet", () => {
    const keys = read("!task call mum estimate:30 ").suggestions.map((s) => s.insert);
    expect(keys).toEqual(["notes:", "tags:", "project:"]);
    expect(read("!task call mum es").suggestions.map((s) => s.insert)).toEqual(["estimate:"]);
  });
});

describe("what Enter can do", () => {
  it("is ready when the Command is headless and complete", () => {
    expect(read("!task call mum #family").ready).toBe(true);
  });

  it("lists the missing required arguments", () => {
    const r = read("!note-on-a-source @Dune");
    expect(r.missing.map((a) => a.key)).toEqual(["body"]);
    expect(r.ready).toBe(false);
  });

  it("is never ready for a Command that is not headless", () => {
    const r = read("!complete-a-task");
    expect(r.command?.id).toBe("tasks.complete");
    expect(r.ready).toBe(false);
  });

  it("previews each understood argument in the order typed", () => {
    expect(read("!task #family call mum @family").parts.map((p) => `${p.arg.key}=${p.text}`)).toEqual(["tags=#family", "title=call mum", "project=Family"]);
  });

  it("hands readCommandArgs values it accepts", async () => {
    const { readCommandArgs } = await import("./commands");
    const r = read('!task call mum estimate:30 #family notes:"oat milk"');
    expect(await readCommandArgs(r.command!.args!, r.args)).toEqual({ title: "call mum", estimate: 30, tags: ["family"], notes: "oat milk" });
  });
});

describe("a date reader plugged in", () => {
  const dates = {
    read: (rest: string) => (rest.startsWith("fri 5pm") ? { date: "2026-10-23", time: "17:00", length: 7, label: "Fri 23 Oct 17:00" } : undefined),
    suggest: () => [{ insert: "fri", label: "Fri 23 Oct" }],
  };
  const EVENT: InlineCommand = {
    appId: "calendar",
    id: "calendar.add-event",
    title: "Add event",
    args: [
      { key: "title", label: "Title", kind: "text", required: true },
      { key: "date", label: "Date", kind: "date" },
      { key: "start", label: "Start", kind: "time" },
    ],
    invoke: ok,
  };

  it("reads / as a date only when a reader is given", () => {
    expect(readInlineLine({ line: "!event dinner /fri 5pm", commands: [EVENT], dates }).args).toEqual({ title: "dinner", date: "2026-10-23", start: "17:00" });
    expect(readInlineLine({ line: "!event dinner /fri 5pm", commands: [EVENT] }).args).toEqual({ title: "dinner /fri 5pm" });
  });
});
