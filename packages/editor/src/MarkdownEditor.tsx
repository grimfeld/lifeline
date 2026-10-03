import { lazy, Suspense, type ComponentProps } from "react";

/*
 * CodeMirror and its markdown grammar load with the first editor shown: they
 * are a large share of the bundle, and reading mode, the Bases and most
 * screens never need them. Same name and props as before.
 */
const Impl = lazy(() => import("./MarkdownEditorImpl").then((m) => ({ default: m.MarkdownEditor })));

export type MarkdownEditorProps = ComponentProps<typeof import("./MarkdownEditorImpl").MarkdownEditor>;

/**
 * CodeMirror 6 markdown editor (live preview flavour, ADR 0009): wikilink and
 * tag decorations, `[[` autocomplete over the note index, `daylog` blocks
 * rendered as live widgets. See MarkdownEditorImpl.
 */
export function MarkdownEditor(props: MarkdownEditorProps) {
  return (
    <Suspense fallback={<div className={`ll-editor min-h-0 flex-1 ${props.className ?? ""}`} />}>
      <Impl {...props} />
    </Suspense>
  );
}
