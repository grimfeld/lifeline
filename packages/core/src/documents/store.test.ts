import { describe, expect, it } from "vitest";
import { attachmentsFollowing } from "./store";

const att = (id: string, name: string, workspace = "", deleted: 0 | 1 = 0) => ({ id, name, workspace, deleted });

describe("attachmentsFollowing (CR-61)", () => {
  it("names the Attachments the moved bodies embed that are not in the target yet", () => {
    const list = [att("a", "Photo.png"), att("b", "other.png"), att("c", "there.png", "w2"), att("d", "gone.png", "", 1)];
    const ids = attachmentsFollowing(list, ["![[photo.PNG]] and ![[there.png]] and ![[gone.png]] and [[Some Note]]"], "w2");
    expect(ids).toEqual(["a"]);
  });

  it("follows a Document out to the shared content too", () => {
    expect(attachmentsFollowing([att("a", "x.png", "w1")], ["![[x.png|200]]"], "")).toEqual(["a"]);
  });
});
