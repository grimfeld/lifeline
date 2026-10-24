import { Suspense, type ComponentProps } from "react";
import { cn, lazyChunk } from "@lifeline/ui";

/*
 * Reading mode loads react-markdown and its micromark parser on first use, as
 * the editor loads CodeMirror (MarkdownEditor.tsx): most first loads draw no
 * body. Until the parser arrives the view holds its place, empty.
 */
const Impl = lazyChunk(() => import("./MarkdownViewImpl").then((m) => ({ default: m.MarkdownView })));

export type MarkdownViewProps = ComponentProps<typeof import("./MarkdownViewImpl").MarkdownView>;

/**
 * Reading mode: renders a Document's markdown with wikilinks resolved through
 * the link index (Document → its route, unresolved → dimmed) and `daylog`
 * fences rendered live. A leading frontmatter block is not shown.
 */
export function MarkdownView(props: MarkdownViewProps) {
  return (
    <Suspense fallback={<div className={cn("prose-note", props.compact && "prose-note-compact", props.className)} data-origin={props.origin} />}>
      <Impl {...props} />
    </Suspense>
  );
}
