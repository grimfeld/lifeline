import { describe, expect, it } from "vitest";
import { bodyToEdit, createEchoes, noteStaged, noteWritten } from "./bodyEcho";

describe("bodyToEdit", () => {
  it("is the stored body while nothing of ours is outstanding", () => {
    const e = createEchoes();
    expect(bodyToEdit(e, "hello", false)).toBe("hello");
  });

  it("keeps what was typed while it is still staged", () => {
    const e = createEchoes();
    noteStaged(e, "hello world");
    expect(bodyToEdit(e, "hello", true)).toBe("hello world");
  });

  it("keeps what was typed while our write is read back", () => {
    const e = createEchoes();
    noteStaged(e, "hello wor");
    noteWritten(e, "hello", "hello wor");
    noteStaged(e, "hello world");
    // The echo of the first write arrives while the rest is still staged.
    expect(bodyToEdit(e, "hello wor", true)).toBe("hello world");
  });

  // The cursor bug: the store had caught up, the next pause flushed, and a
  // render landed before the write came back (another live query emitting
  // first) — the stored body was the one the write replaces, which looked like
  // news, so the editor dropped the last word and then got it back after the caret.
  it("does not take the body a write replaces for news", () => {
    const e = createEchoes();
    noteStaged(e, "hello");
    noteWritten(e, "", "hello");
    expect(bodyToEdit(e, "hello", false)).toBe("hello"); // caught up
    noteStaged(e, "hello world");
    noteWritten(e, "hello", "hello world");
    expect(bodyToEdit(e, "hello", false)).toBe("hello world");
    expect(bodyToEdit(e, "hello world", false)).toBe("hello world");
  });

  it("takes another device's edit", () => {
    const e = createEchoes();
    noteStaged(e, "hello");
    noteWritten(e, "", "hello");
    expect(bodyToEdit(e, "hello", false)).toBe("hello");
    expect(bodyToEdit(e, "hello from the desk", false)).toBe("hello from the desk");
    // Once taken, nothing of ours is outstanding: the next stored body is the body.
    expect(bodyToEdit(e, "hello", false)).toBe("hello");
  });
});
