import { describe, expect, it } from "vitest";
import { exchangeProblem, exchangeTitle, exchangeTitleOf } from "./exchanges";

describe("an Exchange's derived title (ADR 0131)", () => {
  it("is its kind, then the names of its People", () => {
    expect(exchangeTitle("call", ["Grandma"])).toBe("Call · Grandma");
    expect(exchangeTitle("message", ["Marc", "Léa"])).toBe("Message · Marc, Léa");
    expect(exchangeTitle("video", ["Grandma"])).toBe("Video call · Grandma");
    expect(exchangeTitle("letter", ["Grandma"])).toBe("Letter · Grandma");
  });

  it("says nobody once its People are all gone", () => {
    expect(exchangeTitle("call", [])).toBe("Call · nobody");
  });

  it("reads an unknown kind as a call", () => {
    expect(exchangeTitle("telegram", ["Marc"])).toBe("Call · Marc");
  });

  const p = (title: string, folder = "People", workspace = "") => ({ title, folder, workspace });
  it("says someone for a Person in the Private folder, and how many past one, after the names", () => {
    expect(exchangeTitleOf("call", [p("Secret", "Private/People")], "")).toBe("Call · someone");
    expect(exchangeTitleOf("call", [p("Secret", "Private"), p("Marc")], "")).toBe("Call · Marc, someone");
    expect(exchangeTitleOf("letter", [p("A", "Private"), p("Marc"), p("B", "Private/People")], "")).toBe("Letter · Marc, 2 people");
  });
  it("leaves out a Person of another Workspace", () => {
    expect(exchangeTitleOf("call", [p("Marc", "People", "ws2"), p("Léa", "People", "ws2"), p("Far")], "ws2")).toBe("Call · Marc, Léa");
    expect(exchangeTitleOf("call", [p("Far", "People", "ws2")], "")).toBe("Call · nobody");
  });
});

describe("what an Exchange may not be", () => {
  const today = "2026-11-18";
  it("is never on a day to come", () => {
    expect(exchangeProblem({ with: ["p1"], date: "2026-11-19" }, today)).toBe("An exchange is something that happened. Plan a call as a Task or an Event.");
    expect(exchangeProblem({ with: ["p1"], date: today }, today)).toBeUndefined();
    expect(exchangeProblem({ with: ["p1"], date: "2020-01-01" }, today)).toBeUndefined();
  });
  it("is with someone", () => {
    expect(exchangeProblem({ with: [], date: today }, today)).toBe("An exchange is with at least one Person.");
  });
  it("is on a real day", () => {
    expect(exchangeProblem({ with: ["p1"], date: "2026-02-30" }, today)).toBe("Pick the day it happened.");
    expect(exchangeProblem({ with: ["p1"], date: "" }, today)).toBe("Pick the day it happened.");
  });
});
