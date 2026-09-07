import { useMemo, useState, useSyncExternalStore } from "react";
import { Button } from "@lifeline/ui";
import { ImageIcon } from "lucide-react";
import { frameDocument, sanitizeHtml, textToHtml } from "../domain/html";
import type { Message } from "../domain/types";

function subscribeTheme(cb: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
  return () => {
    mq.removeEventListener("change", cb);
    obs.disconnect();
  };
}
function isDark(): boolean {
  const root = document.documentElement;
  if (root.classList.contains("dark") || root.dataset.theme === "dark") return true;
  if (root.classList.contains("light") || root.dataset.theme === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * A Message's body in a sandboxed frame (ADR 0051): sanitised HTML, no
 * scripts, remote images blocked by the frame's CSP until "Load images",
 * links opening outside. Plain text when there is no HTML.
 */
export function MessageBody({ message }: { message: Message }) {
  const [images, setImages] = useState(false);
  const dark = useSyncExternalStore(subscribeTheme, isDark, () => false);
  const hasHtml = !!message.html.trim();
  const remoteImages = hasHtml && /<img[^>]+src=["']?https?:/i.test(message.html);
  const doc = useMemo(() => {
    const body = hasHtml ? sanitizeHtml(message.html) : textToHtml(message.text);
    return frameDocument(body, { allowImages: images, dark });
  }, [message.html, message.text, hasHtml, images, dark]);
  if (!hasHtml && !message.text.trim()) return <p className="text-muted-foreground px-4 py-3 text-sm">This message has no readable body.</p>;
  return (
    <div className="grid gap-1">
      {remoteImages && !images && (
        <div className="text-muted-foreground flex items-center gap-2 px-3 pt-2 text-xs">
          <ImageIcon className="size-3.5" />
          <span>Images are not loaded.</span>
          <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setImages(true)}>
            Load images
          </Button>
        </div>
      )}
      <iframe
        title={message.subject || "Message"}
        // No scripts, no same-origin: the mail cannot touch Lifeline. Popups let links open in a new tab.
        sandbox="allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer"
        srcDoc={doc}
        className="bg-background h-[60vh] min-h-64 w-full rounded-md border"
      />
    </div>
  );
}
