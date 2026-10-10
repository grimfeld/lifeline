import { expect, type Page } from "@playwright/test";

/**
 * What "broken UI" means here, checked on whatever is on screen:
 *
 * - **Spill**: text drawn outside a box that contains it — across a card's
 *   edge, over a neighbour, off the side of the screen.
 * - **Cut**: text clipped sideways by an `overflow: hidden` box without an
 *   ellipsis saying so (`truncate` / `text-ellipsis` is the fix that counts).
 * - **Stray scroll**: a box that scrolls sideways although nobody asked it to
 *   — the vertical scroller that grew a horizontal bar because one row was
 *   too wide.
 *
 * A box that *means* to scroll sideways (a week grid, a wide table, a tab
 * strip) says so with `overflow-x-auto` / `overflow-auto` (or their `scroll`
 * twins) or `data-scroll-x`; what is inside it is free to be wide.
 */
export interface LayoutProblem {
  kind: "spill" | "cut" | "stray-scroll";
  where: string;
  text: string;
  by: number;
}

/** Runs inside the page. */
function findLayoutProblems(): LayoutProblem[] {
  const TOLERANCE = 1.5;
  const problems: LayoutProblem[] = [];
  const seen = new Set<string>();

  const describe = (el: Element): string => {
    const parts: string[] = [];
    let cur: Element | null = el;
    for (let i = 0; cur && i < 4; i++, cur = cur.parentElement) {
      const cls = typeof cur.className === "string" ? cur.className.trim().split(/\s+/).slice(0, 4).join(".") : "";
      parts.unshift(cur.tagName.toLowerCase() + (cls ? `.${cls}` : ""));
    }
    return parts.join(" > ");
  };
  const report = (p: LayoutProblem) => {
    const key = `${p.kind}|${p.where}|${p.text}`;
    if (seen.has(key)) return;
    seen.add(key);
    problems.push(p);
  };

  const isIntentionalScrollX = (el: Element): boolean => {
    if (el.hasAttribute("data-scroll-x")) return true;
    const cls = typeof el.className === "string" ? el.className : "";
    if (/(^|\s|:)overflow-(x-)?(auto|scroll)(\s|$)/.test(cls)) return true;
    // Inline styles and third-party widgets (maps, charts, editors) set it directly.
    const inline = (el as HTMLElement).style;
    return !!inline && /auto|scroll/.test(inline.overflowX || inline.overflow || "");
  };
  const clipsX = (s: CSSStyleDeclaration) => s.overflowX !== "visible";
  const isHidden = (el: Element, s: CSSStyleDeclaration) =>
    s.display === "none" || s.visibility === "hidden" || s.visibility === "collapse" || Number(s.opacity) === 0 || el.closest("[aria-hidden='true'], [inert]") !== null;
  // Screen-reader-only text and other deliberately clipped boxes.
  const isSrOnly = (s: CSSStyleDeclaration, r: DOMRect) => (r.width <= 1 && r.height <= 1) || (s.clip && s.clip !== "auto") || (s.clipPath && s.clipPath !== "none");
  const ellipsizes = (s: CSSStyleDeclaration) => s.textOverflow === "ellipsis" || (s.webkitLineClamp && s.webkitLineClamp !== "none");

  // Stray sideways scrolling.
  for (const el of Array.from(document.querySelectorAll("*"))) {
    const s = getComputedStyle(el);
    if (s.overflowX !== "auto" && s.overflowX !== "scroll") continue;
    if (isIntentionalScrollX(el) || isHidden(el, s)) continue;
    // Third-party content that manages its own viewport.
    if (el.closest(".cm-editor, .leaflet-container, .recharts-wrapper, [data-scroll-x]")) continue;
    const by = el.scrollWidth - el.clientWidth;
    if (by > TOLERANCE) report({ kind: "stray-scroll", where: describe(el), text: (el.textContent ?? "").trim().slice(0, 80), by });
  }

  // Spilled and cut text.
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = (node.textContent ?? "").trim();
    if (!text) continue;
    const host = node.parentElement;
    if (!host || host.closest("script, style, noscript, svg, .cm-editor, .leaflet-container, .recharts-wrapper, [data-layout-ignore]")) continue;
    const hostStyle = getComputedStyle(host);
    if (isHidden(host, hostStyle)) continue;
    // Screen-reader-only text is clipped to nothing on purpose.
    let srOnly = false;
    for (let el: Element | null = host; el && !srOnly; el = el.parentElement) srOnly = isSrOnly(getComputedStyle(el), el.getBoundingClientRect());
    if (srOnly) continue;
    range.selectNodeContents(node);
    const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
    if (rects.length === 0) continue;
    const left = Math.min(...rects.map((r) => r.left));
    const right = Math.max(...rects.map((r) => r.right));

    // Walk outwards: the text must sit inside every box around it, until a
    // box that is allowed to hold wider content (a sideways scroller, a
    // truncating box) or one that is placed on purpose (absolute / fixed).
    let child: Element = host;
    for (let el: Element | null = host; el && el !== document.documentElement; child = el, el = el.parentElement) {
      const s = el === host ? hostStyle : getComputedStyle(el);
      if (s.display === "contents") continue;
      if (isHidden(el, s)) break;
      const r = el.getBoundingClientRect();
      if (s.display !== "inline") {
        const by = Math.max(right - r.right, r.left - left);
        if (by > TOLERANCE) {
          const truncated = ellipsizes(s) && clipsX(s);
          if (!truncated) report({ kind: clipsX(s) ? "cut" : "spill", where: describe(el), text: text.slice(0, 80), by: Math.round(by) });
          break;
        }
      }
      if (isIntentionalScrollX(el) || (ellipsizes(s) && clipsX(s))) break;
      if (el !== host && (getComputedStyle(child).position === "fixed")) break;
    }

    // And inside the screen — as far as it is drawn: a box that clips (a
    // truncating label, a scroller) hides what lies past its edges.
    let shownLeft = left;
    let shownRight = right;
    for (let el: Element | null = host; el && el !== document.documentElement; el = el.parentElement) {
      if (!clipsX(getComputedStyle(el))) continue;
      const r = el.getBoundingClientRect();
      shownLeft = Math.max(shownLeft, r.left);
      shownRight = Math.min(shownRight, r.right);
    }
    if (shownRight <= shownLeft) continue;
    const offRight = shownRight - window.innerWidth;
    const offLeft = -shownLeft;
    if ((offRight > TOLERANCE || offLeft > TOLERANCE) && !host.closest("[data-scroll-x]")) {
      let inScroller = false;
      for (let el: Element | null = host; el; el = el.parentElement) if (isIntentionalScrollX(el)) inScroller = true;
      // Wholly off screen and not reachable: a closed drawer parked aside.
      const parked = shownRight <= 0 || shownLeft >= window.innerWidth;
      if (!inScroller && !parked) report({ kind: "spill", where: `viewport ← ${describe(host)}`, text: text.slice(0, 80), by: Math.round(Math.max(offRight, offLeft)) });
    }
  }
  return problems;
}

/** Waits for the page to settle, then lists every broken box, one readable line each. */
export async function layoutProblems(page: Page): Promise<string[]> {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const problems = await page.evaluate(findLayoutProblems);
  return problems.map((p) => `[${p.kind}] by ${p.by}px — “${p.text}”\n      at ${p.where}`);
}

/** Fails listing every broken box on the page. */
export async function expectNoBrokenLayout(page: Page, label: string): Promise<void> {
  const problems = await layoutProblems(page);
  expect(problems, `${label} has broken layout:\n  ${problems.join("\n  ")}`).toEqual([]);
}
