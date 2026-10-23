import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: string[] = [];
vi.mock("../private", () => ({ lockPrivate: async () => void calls.push("lock") }));
vi.mock("./db", () => ({ db: () => ({ delete: async () => void calls.push("delete") }) }));
vi.mock("./pb", () => ({ pb: { authStore: { clear: () => void calls.push("clear") } } }));

const { signOut } = await import("./account");

describe("signOut (#261)", () => {
  beforeEach(() => {
    calls.length = 0;
    vi.stubGlobal("location", { reload: () => void calls.push("reload") });
  });

  it("forgets the session, then erases the device by default", async () => {
    await signOut();
    expect(calls).toEqual(["clear", "delete", "reload"]);
  });

  it("keeps the device's data when asked, with Private locked", async () => {
    await signOut({ keepData: true });
    expect(calls).toEqual(["clear", "lock"]);
  });
});
