import { Suspense, type ComponentProps } from "react";
import { cn, lazyChunk } from "@lifeline/ui";

// Loads react-markdown on first use, as MarkdownView does.
const Impl = lazyChunk(() => import("./PlainMarkdownViewImpl").then((m) => ({ default: m.PlainMarkdownView })));

/**
 * Markdown that is no Document's body — the Guide's pages: the reading view's
 * look, without wikilinks, Daylog blocks or attachments. `onLink` takes a link
 * first and returns true when it handled it; any other link opens in a new tab.
 */
export function PlainMarkdownView(props: ComponentProps<typeof Impl>) {
  return (
    <Suspense fallback={<div className={cn("prose-note", props.className)} />}>
      <Impl {...props} />
    </Suspense>
  );
}
