import { describe, expect, it } from "vitest";
import { derivePrivateHash, inPrivateFolder, mayBePrivate, PRIVATE_FOLDER, visibleUnder } from "./private";
import type { DocumentTypeDef } from "./documents/types";

const T = (extra: Partial<DocumentTypeDef>): DocumentTypeDef => ({ id: "x", label: "Xs", titleRule: "name", body: "optional", fields: [], builtIn: true, ...extra });

describe("Private folder (ADR 0038)", () => {
  it("is the reserved folder and everything below it, not a look-alike", () => {
    expect(inPrivateFolder(PRIVATE_FOLDER)).toBe(true);
    expect(inPrivateFolder("Private/Diary/2026")).toBe(true);
    expect(inPrivateFolder("")).toBe(false);
    expect(inPrivateFolder("Privateer")).toBe(false);
    expect(inPrivateFolder("Notes/Private")).toBe(false);
  });

  it("a locked gate drops Private rows, an open one lets everything through", () => {
    const rows = [{ folder: "" }, { folder: "Private" }, { folder: "Private/Sub" }, { folder: "Journal/2026/08" }];
    expect(visibleUnder(rows, { configured: true, locked: true }).map((r) => r.folder)).toEqual(["", "Journal/2026/08"]);
    expect(visibleUnder(rows, { configured: true, locked: false })).toBe(rows);
    expect(visibleUnder(rows, { configured: false, locked: false })).toBe(rows);
  });

  it("only body-first types may live in Private; internal and field-only types may not", () => {
    expect(mayBePrivate(T({ body: "required" }))).toBe(true);
    expect(mayBePrivate(T({ body: "optional", vault: true }))).toBe(true);
    expect(mayBePrivate(T({ body: "none" }))).toBe(false);
    expect(mayBePrivate(T({ body: "optional" }))).toBe(false);
    expect(mayBePrivate(T({ body: "required", internal: true }))).toBe(false);
    expect(mayBePrivate(undefined)).toBe(false);
  });

  it("hashes deterministically per salt and never stores the password", async () => {
    const salt = new Uint8Array(16).fill(7);
    const a = await derivePrivateHash("hunter2", salt, 1000);
    const b = await derivePrivateHash("hunter2", salt, 1000);
    const c = await derivePrivateHash("hunter3", salt, 1000);
    const d = await derivePrivateHash("hunter2", new Uint8Array(16).fill(8), 1000);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).not.toBe(d);
    expect(a).not.toContain("hunter");
    expect(a.length).toBe(44); // 32 bytes, base64
  });
});
