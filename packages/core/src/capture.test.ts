import { describe, expect, it } from "vitest";
import { MACRO_APP, macroCommand, type MacroStep } from "./macros";
import { commandAppTitle } from "./registry";
import { CAPTURE_PINS_MAX, buildCaptureSheet, movePin, togglePin, type CaptureCommand, type CaptureSheetInput } from "./capture";

const MODULE_OF: Record<string, string | undefined> = {
  shopping: "house",
  tasks: "tasks",
  cinema: "culture",
  library: "culture",
  pocket: "money",
  calendar: undefined,
};
const TITLE: Record<string, string> = { calendar: "Calendar", cinema: "Cinema", library: "Library", shopping: "Shopping list", tasks: "Tasks", pocket: "Pocket" };

function cmd(appId: string, id: string, extra: Partial<CaptureCommand> = {}): CaptureCommand {
  return { appId, id, title: id, capture: true, ...extra };
}

const COMMANDS: CaptureCommand[] = [
  cmd("tasks", "add-task"),
  cmd("shopping", "add-need"),
  cmd("cinema", "add-movie", { fold: "culture.add", foldLabel: "Film" }),
  cmd("cinema", "mark-watched", { fold: "culture.done" }),
  cmd("library", "add-book", { fold: "culture.add", foldLabel: "Book" }),
  cmd("pocket", "spend"),
  cmd("pocket", "settings", { capture: false }),
  cmd("calendar", "add-event"),
  cmd("calendar", "today.gym", { fold: "calendar.today" }),
  cmd("calendar", "today.dentist", { fold: "calendar.today" }),
];

function sheet(over: Partial<CaptureSheetInput> = {}) {
  return buildCaptureSheet({
    commands: COMMANDS,
    modules: ["house", "tasks", "culture", "money"],
    moduleOf: (id) => MODULE_OF[id],
    appTitle: (id) => TITLE[id],
    pins: [],
    ...over,
  });
}

describe("the capture sheet's groups", () => {
  it("leads with the Calendar, then follows Core's Module order, never the Workspace's", () => {
    const s = sheet({ modules: ["money", "culture", "tasks", "house"] });
    expect(s.groups.map((g) => g.title)).toEqual(["Calendar", "House", "Projects", "Culture", "Money"]);
  });

  it("lists only capture Commands", () => {
    const keys = sheet().groups.flatMap((g) => g.entries.map((e) => e.key));
    expect(keys).not.toContain("pocket/settings");
  });

  it("offers only the Workspace's Modules, and the Calendar in every Workspace", () => {
    const s = sheet({ modules: ["house"] });
    expect(s.groups.map((g) => g.id)).toEqual(["app:calendar", "house"]);
  });

  it("offers everything when the Workspace has chosen no Modules", () => {
    expect(sheet({ modules: [] }).groups).toHaveLength(5);
  });
});

describe("folds", () => {
  it("stand in for the Commands folded under them, members in registry order", () => {
    const culture = sheet().groups.find((g) => g.id === "culture")!;
    expect(culture.entries.map((e) => e.key)).toEqual(["fold:culture.add", "fold:culture.done"]);
    const add = culture.entries[0]!;
    expect(add.kind === "fold" && add.members.map((m) => m.id)).toEqual(["add-movie", "add-book"]);
  });

  it("fold one type's templates too, beside the plain Command", () => {
    const cal = sheet().groups[0]!;
    expect(cal.entries.map((e) => e.key)).toEqual(["calendar/add-event", "fold:calendar.today"]);
  });

  it("vanish when nothing is folded under them", () => {
    const s = sheet({ commands: COMMANDS.filter((c) => c.fold !== "calendar.today") });
    expect(s.groups[0]!.entries.map((e) => e.key)).toEqual(["calendar/add-event"]);
  });

  it("leave folded Commands pinnable", () => {
    const keys = sheet().pinnable.map((e) => e.key);
    expect(keys).toContain("cinema/add-movie");
    expect(keys).toContain("fold:culture.add");
    expect(keys).toContain("calendar/today.gym");
  });

  it("are ignored when the App names one Core does not know", () => {
    const s = sheet({ commands: [cmd("tasks", "x", { fold: "made-up" })] });
    expect(s.groups[0]!.entries[0]).toMatchObject({ kind: "command", key: "tasks/x" });
  });
});

describe("pins", () => {
  it("come back in the user's order, folded Commands and folds alike", () => {
    const s = sheet({ pins: ["pocket/spend", "cinema/add-movie", "fold:calendar.today"] });
    expect(s.pinned.map((e) => e.key)).toEqual(["pocket/spend", "cinema/add-movie", "fold:calendar.today"]);
  });

  it("never take a Command out of its group", () => {
    const pinnedSheet = sheet({ pins: ["pocket/spend"] });
    expect(pinnedSheet.groups).toEqual(sheet().groups);
  });

  it("drop out when their Command leaves the Workspace, and nothing takes their place", () => {
    const s = sheet({ modules: ["house"], pins: ["pocket/spend", "shopping/add-need"] });
    expect(s.pinned.map((e) => e.key)).toEqual(["shopping/add-need"]);
  });

  it("start empty — nothing is guessed", () => {
    expect(sheet().pinned).toEqual([]);
  });

  it("refuse a pin past the limit rather than dropping an old one", () => {
    const live = new Set(Array.from({ length: CAPTURE_PINS_MAX + 1 }, (_, i) => `a/${i}`));
    const full = Array.from({ length: CAPTURE_PINS_MAX }, (_, i) => `a/${i}`);
    expect(togglePin(full, `a/${CAPTURE_PINS_MAX}`, live)).toBeNull();
    expect(togglePin(full, "a/0", live)).toHaveLength(CAPTURE_PINS_MAX - 1);
  });

  it("do not count stale pins against the limit", () => {
    const full = Array.from({ length: CAPTURE_PINS_MAX }, (_, i) => `a/${i}`);
    const live = new Set(["a/1", "new/one"]);
    expect(togglePin(full, "new/one", live)).toContain("new/one");
  });

  it("move one place at a time, the others keeping theirs", () => {
    expect(movePin(["a", "b", "c"], "c", -1)).toEqual(["a", "c", "b"]);
    expect(movePin(["a", "b", "c"], "a", -1)).toEqual(["a", "b", "c"]);
  });
});

describe("capture Macros", () => {
  const step = (command: string): MacroStep => ({ command, args: {} });
  const nav = cmd("tasks", "open-board", { capture: false, run: () => {} });
  const own = [...COMMANDS, nav];
  const macro = (id: string, ...steps: string[]) => macroCommand({ id, name: id, steps: steps.map(step) }, own);
  const withMacros = (...ms: CaptureCommand[]) => ({ commands: [...own, ...ms] });

  it("is capture when every step is capture and none navigates", () => {
    expect(macro("m", "tasks/add-task", "pocket/spend").capture).toBe(true);
  });

  it("is not capture when a step is not capture", () => {
    expect(macro("m", "tasks/add-task", "pocket/settings").capture).toBe(false);
  });

  it("is not capture when a step navigates", () => {
    const navCapture = cmd("tasks", "go", { run: () => {} });
    const m = macroCommand({ id: "m", name: "m", steps: [step("tasks/go")] }, [navCapture]);
    expect(m.capture).toBe(false);
  });

  it("is not capture when a step's Command is gone, or it has no steps", () => {
    expect(macro("m", "tasks/add-task", "tasks/gone").capture).toBe(false);
    expect(macro("m").capture).toBe(false);
  });

  it("is listed under a group titled Macros, and pinnable", () => {
    const m = macro("m", "tasks/add-task");
    const s = sheet({ ...withMacros(m), appTitle: commandAppTitle, moduleOf: (id) => MODULE_OF[id] });
    const group = s.groups.find((g) => g.id === `app:${MACRO_APP}`);
    expect(group?.title).toBe("Macros");
    expect(s.pinnable.map((e) => e.key)).toContain(`${MACRO_APP}/m`);
  });

  it("keeps a Macro that navigates off the sheet", () => {
    const m = macro("m", "tasks/open-board");
    const s = sheet(withMacros(m));
    expect(s.pinnable.map((e) => e.key)).not.toContain(`${MACRO_APP}/m`);
  });

  it("drops a pin whose Macro is deleted or stopped being capture", () => {
    const pins = [`${MACRO_APP}/m`];
    expect(sheet({ ...withMacros(macro("m", "tasks/add-task")), pins }).pinned).toHaveLength(1);
    expect(sheet({ pins }).pinned).toHaveLength(0);
    expect(sheet({ ...withMacros(macro("m", "tasks/open-board")), pins }).pinned).toHaveLength(0);
  });
});
