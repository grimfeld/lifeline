import { describe, expect, it } from "vitest";
import { intakeListUrl, readIntakeList } from "./index";

describe("the Intakes list a Lifeline publishes", () => {
  it("is at /intakes.json on that Lifeline", () => {
    expect(intakeListUrl("https://lifeline.example")).toBe("https://lifeline.example/intakes.json");
    expect(intakeListUrl("https://host.example/app/")).toBe("https://host.example/app/intakes.json");
  });

  it("reads back as its Intakes, in order", () => {
    const list = { intakes: [{ key: "tasks/task", title: "Task" }, { key: "commonplace/quote", title: "Quote" }] };
    expect(readIntakeList(JSON.parse(JSON.stringify(list)))).toEqual(list.intakes);
  });

  it("keeps only the entries that are an Intake key and a title", () => {
    const list = { intakes: [{ key: "tasks/task", title: "Task" }, { key: "no-slash", title: "X" }, { key: "a/b" }, { key: "a/b", title: "" }, "tasks/task", null, { key: "calendar/event", title: "Event", icon: "x" }] };
    expect(readIntakeList(list)).toEqual([{ key: "tasks/task", title: "Task" }, { key: "calendar/event", title: "Event" }]);
  });

  it("is nothing at all when the answer is not a list", () => {
    for (const bad of [null, undefined, "x", 3, [], {}, { intakes: "x" }, { intakes: {} }]) expect(readIntakeList(bad)).toBeNull();
  });
});
