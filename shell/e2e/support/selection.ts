import type { Locator } from "@playwright/test";

/**
 * Select the first occurrence of `text` inside `body` — a Markdown editor's
 * content or a rendered body — the way a person's drag would. In an editor
 * the content is focused first: CodeMirror reads the DOM selection only while
 * it has focus, and then keeps it as its own.
 */
export async function selectText(body: Locator, text: string): Promise<void> {
  await body.evaluate((root, text) => {
    const editable = root.closest(".cm-content") ?? root.querySelector(".cm-content");
    if (editable instanceof HTMLElement) editable.focus();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const at = n.textContent?.indexOf(text) ?? -1;
      if (at < 0) continue;
      const range = document.createRange();
      range.setStart(n, at);
      range.setEnd(n, at + text.length);
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    throw new Error(`“${text}” is not in the body`);
  }, text);
}
