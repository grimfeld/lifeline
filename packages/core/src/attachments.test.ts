import { describe, expect, it } from "vitest";
import { attachmentName, embeddedNames, orphanedAmong, resolveAttachment, sanitizeAttachmentName, type Attachment } from "./attachments";
import { isImageEmbed, isImageName } from "./markdown";
import { buildLinkIndex } from "./documents/links";
import type { Document, DocumentTypeDef } from "./documents/types";

const att = (id: string, name: string, updatedAt = "2026-08-30T10:00:00.000Z", deleted: 0 | 1 = 0): Attachment => ({ id, name, mime: "image/png", size: 1, updatedAt, deleted });

describe("isImageName", () => {
  it("matches image extensions only", () => {
    expect(isImageName("Pasted image 20260830143000.png")).toBe(true);
    expect(isImageName("photo.JPG")).toBe(true);
    expect(isImageName("Some Note")).toBe(false);
    expect(isImageName("notes.md")).toBe(false);
  });
  it("an embed of an image is an Attachment reference; a plain link or a note embed is not", () => {
    expect(isImageEmbed({ embed: true, name: "a.png" })).toBe(true);
    expect(isImageEmbed({ embed: false, name: "a.png" })).toBe(false);
    expect(isImageEmbed({ embed: true, name: "Some Note" })).toBe(false);
  });
});

describe("attachmentName", () => {
  const never = () => false;
  it("a pasted image is stamped", () => {
    expect(attachmentName(undefined, "png", never, new Date(2026, 7, 30, 14, 30, 5))).toBe("Pasted image 20260830143005.png");
  });
  it("a dropped file keeps its stem and takes the stored bytes' extension", () => {
    expect(attachmentName("IMG_4521.HEIC", "jpg", never)).toBe("IMG_4521.jpg");
    expect(attachmentName("shot.png", "png", never)).toBe("shot.png");
  });
  it("a taken name gets a counter", () => {
    const taken = new Set(["shot.png", "shot 1.png"]);
    expect(attachmentName("shot.png", "png", (n) => taken.has(n))).toBe("shot 2.png");
  });
  it("characters that break a wikilink become dashes", () => {
    expect(sanitizeAttachmentName("a|b[c]#d^e/f.png")).toBe("a-b-c--d-e-f.png");
    expect(attachmentName("we|ird.png", "png", never)).toBe("we-ird.png");
  });
});

describe("resolveAttachment", () => {
  it("compares names like wikilinks and prefers the oldest on a tie", () => {
    const list = [att("b", "Élan.png", "2026-08-30T11:00:00.000Z"), att("a", "elan.PNG", "2026-08-30T10:00:00.000Z"), att("z", "other.png")];
    expect(resolveAttachment(list, " élan.png ")?.id).toBe("a");
    expect(resolveAttachment(list, "nope.png")).toBeUndefined();
  });
  it("ignores tombstones", () => {
    expect(resolveAttachment([att("a", "x.png", "2026-08-30T10:00:00.000Z", 1)], "x.png")).toBeUndefined();
  });
});

describe("orphans", () => {
  it("names embedded by bodies, normalised; plain links and code do not count", () => {
    const names = embeddedNames(["see ![[Shot.png]] and [[Other.png]]", "`![[code.png]]`", ""]);
    expect([...names]).toEqual(["shot.png"]);
  });
  it("an Attachment no body embeds is orphaned", () => {
    const list = [att("a", "used.png"), att("b", "orphan.png"), att("c", "gone.png", "2026-08-30T10:00:00.000Z", 1)];
    const docs = [{ body: "![[used.png]]" }, { body: undefined }];
    expect(orphanedAmong(list, docs).map((a) => a.id)).toEqual(["b"]);
  });
});

describe("link index and image embeds", () => {
  const note: DocumentTypeDef = { id: "note", label: "Notes", titleRule: "name", body: "required", fields: [], linkable: true } as unknown as DocumentTypeDef;
  const doc = (id: string, title: string, body: string): Document => ({ id, type: "note", title, body, tags: [], folder: "", createdAt: "2026-08-30", updatedAt: "2026-08-30T10:00:00.000Z", deleted: 0 }) as unknown as Document;
  it("an image embed is never an unresolved link, a note embed still is", () => {
    const idx = buildLinkIndex([doc("1", "A", "![[shot.png]] ![[Missing Note]] [[B]]"), doc("2", "B", "")], [note]);
    expect(idx.unresolved.has("shot.png")).toBe(false);
    expect(idx.unresolved.has("missing note")).toBe(true);
    expect(idx.linksFrom("1").map((l) => l.link.name)).toEqual(["Missing Note", "B"]);
  });
});
