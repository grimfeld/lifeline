import { useEffect, useRef } from "react";
import { pageTo, pagingStep } from "../domain/paging";

/** Whether keys pressed at `el` belong to typing: an input, a textarea, a select or anything editable (the editor). */
function isTyping(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || !!el.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])");
}

/**
 * Alt+←/→ and Alt+Shift+←/→ page the Journal from `pageKey` — a Day's date
 * or a period key (#213). They never fire while typing (on a Mac, Alt+←/→
 * moves by word there) or inside a dialog; `Esc` leaves the editor so they
 * become available.
 */
export function useJournalPaging(notes: readonly { type: string; title: string; body?: string }[], pageKey: string, open: (key: string) => void): void {
  const latest = useRef({ notes, pageKey, open });
  // The page last asked for, until the page shows it: a second key pressed before the screen
  // has rendered the first one's page steps on from there, not from the page still showing.
  const asked = useRef<string | undefined>(undefined);
  useEffect(() => {
    latest.current = { notes, pageKey, open };
  });
  useEffect(() => {
    asked.current = undefined;
  }, [pageKey]);

  useEffect(() => {
    // Esc leaves the editor — after it has collapsed a selection, but not when it only closes the completion list.
    let leave: HTMLElement | undefined;
    const onEscape = (e: KeyboardEvent) => {
      const editor = e.key === "Escape" && e.target instanceof HTMLElement ? e.target.closest(".cm-editor") : null;
      leave = editor && !editor.querySelector(".cm-tooltip-autocomplete") ? (e.target as HTMLElement) : undefined;
    };
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.key === "Escape") {
        if (leave === target) target?.blur();
        leave = undefined;
        return;
      }
      const step = pagingStep(e);
      if (!step || isTyping(target) || (target instanceof HTMLElement && target.closest("[role='dialog']"))) return;
      e.preventDefault();
      const { notes, pageKey, open } = latest.current;
      const to = pageTo(notes, asked.current ?? pageKey, step);
      if (!to) return;
      asked.current = to;
      open(to);
    };
    window.addEventListener("keydown", onEscape, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onEscape, true);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
}
