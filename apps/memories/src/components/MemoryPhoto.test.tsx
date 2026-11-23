// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { expect, it } from "vitest";
import { addAttachment, allAttachments, initApps, put, type Attachment } from "@lifeline/core";
import { MemoryPhoto } from "./MemoryPhoto";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// The store opened, as the app has it: the Attachments are read from it.
initApps([]);
// jsdom makes no object URLs; the photo's bytes stand behind this one.
URL.createObjectURL = () => "blob:photo";

async function mount(body: string | undefined) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(<MemoryPhoto body={body} className="size-full" onMissing={() => <p>title only</p>} />);
  });
  // Let the Attachments query and its confirming read settle.
  for (let i = 0; i < 5; i++) await act(() => new Promise((r) => setTimeout(r, 30)));
  return host;
}

it("a photo that resolves to no Attachment shows the title-only tile, not the loading placeholder", async () => {
  const host = await mount("Warm night.\n\n![[gone.jpg]]\n");
  expect(host.textContent).toBe("title only");
  expect(host.querySelector('[aria-label="Loading photo"]')).toBeNull();
});

it("a photo whose bytes cannot be read (none on this device, never uploaded) shows the title-only tile", async () => {
  await put<Attachment>("attachments", { id: "nobytes", name: "unread.png", mime: "image/png", size: 1 });
  expect((await allAttachments()).map((a) => a.name)).toContain("unread.png");
  const host = await mount("Warm night.\n\n![[unread.png]]\n");
  expect(host.textContent).toBe("title only");
  expect(host.querySelector('[aria-label="Loading photo"]')).toBeNull();
});

it("a photo kept as an Attachment shows itself, not the title-only tile", async () => {
  const kept = await addAttachment(new File(["GIF89a"], "warm.gif", { type: "image/gif" }));
  const host = await mount(`Warm night.\n\n![[${kept.name}]]\n`);
  expect(host.textContent).not.toContain("title only");
  expect(host.querySelector("img")?.getAttribute("src")).toBe("blob:photo");
});

it("a body with no photo shows the title-only tile", async () => {
  expect((await mount("Just words.")).textContent).toBe("title only");
});
