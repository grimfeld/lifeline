import { toast } from "@lifeline/ui";
import { appendBlockToDaily } from "./repo";

/**
 * Cross-App bridge without imports (Apps never import each other, ADR 0001):
 * another App dispatches `lifeline:append-to-daily` with `{ detail: { text } }`
 * and the Notes App appends that markdown to today's daily note. The Media
 * App uses it for "Insert quote into today's note". Registered once at import.
 */
export const APPEND_TO_DAILY_EVENT = "lifeline:append-to-daily";

let registered = false;
export function registerNotesBridge(): void {
  if (registered || typeof window === "undefined") return;
  registered = true;
  window.addEventListener(APPEND_TO_DAILY_EVENT, (e) => {
    const text = (e as CustomEvent<{ text?: string }>).detail?.text;
    if (!text?.trim()) return;
    appendBlockToDaily(text)
      .then(() => toast.success("Added to today's note"))
      .catch((err: Error) => toast.error(err.message));
  });
}
