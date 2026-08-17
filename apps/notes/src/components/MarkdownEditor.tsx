import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, drawSelection, highlightActiveLine, keymap, placeholder as cmPlaceholder } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { completionKeymap } from "@codemirror/autocomplete";
import type { NoteIndex } from "../domain/index";
import {
  contextField,
  daylogField,
  indexField,
  setContext,
  setIndex,
  wikilinkClick,
  wikilinkCompletion,
  wikilinkPlugin,
  type EditorContext,
} from "./editorExtensions";
import "./notes.css";

const mdHighlight = HighlightStyle.define([
  { tag: t.heading1, fontSize: "1.5em", fontWeight: "600" },
  { tag: t.heading2, fontSize: "1.3em", fontWeight: "600" },
  { tag: t.heading3, fontSize: "1.15em", fontWeight: "600" },
  { tag: [t.heading4, t.heading5, t.heading6], fontWeight: "600" },
  { tag: t.strong, fontWeight: "700" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.link, color: "var(--primary)", textDecoration: "underline" },
  { tag: t.url, color: "var(--muted-foreground)" },
  { tag: t.monospace, fontFamily: "ui-monospace, monospace", background: "color-mix(in oklab, var(--muted) 60%, transparent)", borderRadius: "0.25rem" },
  { tag: t.quote, color: "var(--muted-foreground)", fontStyle: "italic" },
  { tag: t.processingInstruction, color: "var(--muted-foreground)" },
  { tag: t.meta, color: "var(--muted-foreground)" },
  { tag: t.contentSeparator, color: "var(--muted-foreground)" },
]);

/**
 * CodeMirror 6 markdown editor (live preview flavour, ADR 0009): wikilink and
 * tag decorations, `[[` autocomplete over the note index, `daylog` blocks
 * rendered as live widgets. Uncontrolled: `value` seeds the doc and is only
 * re-applied when it changes externally.
 */
export function MarkdownEditor({
  value,
  onChange,
  index,
  context,
  placeholder,
  autoFocus,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  index: NoteIndex;
  context: EditorContext;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const lastValue = useRef(value);

  useEffect(() => {
    if (!host.current) return;
    const state = EditorState.create({
      doc: value,
      extensions: [
        history(),
        drawSelection(),
        highlightActiveLine(),
        EditorView.lineWrapping,
        markdown({ base: markdownLanguage }),
        syntaxHighlighting(mdHighlight),
        indexField.init(() => index),
        contextField.init(() => context),
        wikilinkPlugin,
        wikilinkClick,
        wikilinkCompletion(),
        daylogField,
        keymap.of([...defaultKeymap, ...historyKeymap, ...completionKeymap, indentWithTab]),
        placeholder ? cmPlaceholder(placeholder) : [],
        EditorView.updateListener.of((u) => {
          if (u.docChanged) {
            const next = u.state.doc.toString();
            lastValue.current = next;
            onChangeRef.current(next);
          }
        }),
      ],
    });
    const view = new EditorView({ state, parent: host.current });
    viewRef.current = view;
    if (autoFocus) {
      view.dispatch({ selection: { anchor: view.state.doc.length } });
      view.focus();
    }
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // The editor is created once per mount; value/index/context are pushed via effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || value === lastValue.current) return;
    lastValue.current = value;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
  }, [value]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: setIndex.of(index) });
  }, [index]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: setContext.of(context) });
  }, [context]);

  return <div ref={host} className={`ll-editor min-h-0 flex-1 ${className ?? ""}`} />;
}
