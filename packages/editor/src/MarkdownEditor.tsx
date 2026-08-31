import { useEffect, useRef, useState } from "react";
import { Annotation, Compartment, EditorState } from "@codemirror/state";
import { EditorView, drawSelection, highlightActiveLine, keymap, placeholder as cmPlaceholder } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { completionKeymap } from "@codemirror/autocomplete";
import { useAttachments, useIsMobile, useKeyboardInset, type LinkIndex } from "@lifeline/core";
import {
  attachmentsField,
  contextField,
  daylogField,
  focusTracking,
  focusedField,
  imageEmbedField,
  indexField,
  setAttachments,
  setContext,
  setFocused as setFocusedEffect,
  setIndex,
  wikilinkClick,
  wikilinkCompletion,
  wikilinkPlugin,
  type EditorContext,
} from "./editorExtensions";
import { attachmentDrop } from "./attachmentCommands";
import { ACCESSORY_BAR_HEIGHT, EditorAccessoryBar } from "./EditorAccessoryBar";
import { textChange } from "./textDiff";
import "./editor.css";

/** Bottom scroll margin while the accessory bar covers the editor's foot. */
const keyboardMargin = new Compartment();

/** A value pushed in from outside (the stored Document changed): not the user's edit. */
const external = Annotation.define<boolean>();

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
 * re-applied when it changes externally — as a minimal change, marked
 * `external` so it is never reported back through `onChange` (an echoed
 * write would be stored and synced as if the user had typed it).
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
  index: LinkIndex;
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
  /** The editor has changes the owner has not handed back yet — it is ahead of `value`. */
  const dirty = useRef(false);
  const isMobile = useIsMobile();
  const inset = useKeyboardInset(isMobile);
  // The accessory bar is React, so the view and the editor's focus are mirrored
  // into state: a StateField changing is not, by itself, a render.
  const [focused, setFocused] = useState(false);
  const [view, setView] = useState<EditorView | null>(null);
  const attachments = useAttachments();

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
        attachmentsField.init(() => attachments),
        wikilinkPlugin,
        wikilinkClick,
        wikilinkCompletion(),
        focusedField,
        focusTracking,
        daylogField,
        imageEmbedField,
        attachmentDrop,
        keyboardMargin.of([]),
        keymap.of([...defaultKeymap, ...historyKeymap, ...completionKeymap, indentWithTab]),
        placeholder ? cmPlaceholder(placeholder) : [],
        EditorView.updateListener.of((u) => {
          // `focusedField` and not `u.focusChanged`: the field is the editor's own
          // record of focus, so the bar and the daylog widgets agree on one answer.
          const now = u.state.field(focusedField, false) ?? false;
          if (now !== (u.startState.field(focusedField, false) ?? false)) setFocused(now);
          if (!u.docChanged) return;
          const next = u.state.doc.toString();
          lastValue.current = next;
          if (u.transactions.some((tr) => tr.annotation(external))) return;
          dirty.current = true;
          onChangeRef.current(next);
        }),
      ],
    });
    const view = new EditorView({ state, parent: host.current });
    viewRef.current = view;
    setView(view);
    if (autoFocus) {
      view.dispatch({ selection: { anchor: view.state.doc.length } });
      view.focus();
    }
    // CodeMirror announces focus *changes* only, so a view that comes up focused
    // never announces anything: without this seed the bar stays away until the
    // user has blurred and come back (and `focusedField` misreports the same way).
    if (view.hasFocus) {
      view.dispatch({ effects: setFocusedEffect.of(true) });
      setFocused(true);
    }
    return () => {
      view.destroy();
      viewRef.current = null;
      setView(null);
    };
    // The editor is created once per mount; value/index/context are pushed via effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (value === lastValue.current) {
      // The owner has caught up with what was typed here.
      dirty.current = false;
      return;
    }
    // Effects run a paint after the render that read `value`, and more may have
    // been typed since. While this editor holds changes the owner has not
    // handed back, its text is the newer one: a value computed before those
    // keystrokes is stale and would undo them.
    if (dirty.current) return;
    lastValue.current = value;
    const change = textChange(view.state.doc.toString(), value);
    if (change) view.dispatch({ changes: change, annotations: external.of(true) });
  }, [value]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: setIndex.of(index) });
  }, [index]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: setContext.of(context) });
  }, [context]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: setAttachments.of(attachments) });
  }, [attachments]);

  // The bar sits over the editor's last lines: without this the caret is scrolled
  // to a "visible" position that is underneath it. The keyboard and the phone nav
  // need no margin of their own — the frame ends above both (the nav reserves the
  // keyboard's strip, Chromium's viewport resize does it there) — so the bar's own
  // height is the whole of what covers the text.
  useEffect(() => {
    const bottom = isMobile && focused ? ACCESSORY_BAR_HEIGHT : 0;
    const margin = bottom ? EditorView.scrollMargins.of(() => ({ bottom })) : [];
    viewRef.current?.dispatch({ effects: keyboardMargin.reconfigure(margin) });
  }, [isMobile, focused]);

  return (
    <>
      <div ref={host} className={`ll-editor min-h-0 flex-1 ${className ?? ""}`} />
      {isMobile && focused && view && <EditorAccessoryBar view={view} inset={inset} />}
    </>
  );
}
