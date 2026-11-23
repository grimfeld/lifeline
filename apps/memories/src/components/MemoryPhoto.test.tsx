// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { expect, it } from "vitest";
import { MemoryPhoto } from "./MemoryPhoto";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

it("a body with no photo shows the title-only tile", async () => {
  expect((await mount("Just words.")).textContent).toBe("title only");
});
