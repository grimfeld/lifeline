import { useEffect, useRef, useState } from "react";
import { Annotation, Compartment, EditorState } from "@codemirror/state";
import { EditorView, drawSelection, highlightActiveLine, keymap, placeholder as cmPlaceholder } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { completionKeymap } from "@codemirror/autocomplete";
import { useAttachments, useKeyboardInset, usePhoneNavHeight, type LinkIndex } from "@lifeline/core";
import { cn, usePhone } from "@lifeline/ui";
import {
  attachmentsField,
  contextField,
  daylogField,
  focusTracking,
  focusedField,
  imageEmbedField,
  indexField,
  peekLinkKey,
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
import { caretRoom } from "./caretRoom";
import { isUserScrollUp } from "./userScroll";
import { ACCESSORY_BAR_HEIGHT, EditorAccessoryBar } from "./EditorAccessoryBar";
import { textChange } from "./textDiff";
import { provideEditorFinder, SELECTION_EVENT } from "./selection";
import "./editor.css";
// PROTOTYPE for #372 — throwaway, never merged: live preview, smart typing, the variant switcher.
import { livePreview } from "./livePreview.prototype";
import { smartTyping } from "./smartTyping.prototype";
import { getVariant, pillEnabled, subscribeVariant, syncVariantFromUrl, variantFacet } from "./variant.prototype";
import { PILL_ROOM, VariantPill } from "./VariantPill.prototype";

// The body selection reader (selection.ts) reaches editors through this chunk.
provideEditorFinder((dom) => EditorView.findFromDOM(dom));

/** The caret's scroll margins and the document's tail — both sized from the editor's box. */
const room = new Compartment();
/** PROTOTYPE #372: the live-preview reveal variant. */
const variantRoom = new Compartment();

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
  onQuietChange,
}: {
  value: string;
  onChange: (next: string) => void;
  index: LinkIndex;
  context: EditorContext;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  /**
   * Whether the chrome around the editor should get out of the way (ADR 0021,
   * amended): true while the caret is in the body and the user has not asked
   * for it back. The editor owns this because it is the only thing that knows
   * about the caret, typing and the scroller.
   */
  onQuietChange?: (quiet: boolean) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onQuietChangeRef = useRef(onQuietChange);
  onQuietChangeRef.current = onQuietChange;
  const lastValue = useRef(value);
  /** The editor has changes the owner has not handed back yet — it is ahead of `value`. */
  const dirty = useRef(false);
  const isMobile = usePhone();
  const inset = useKeyboardInset(isMobile);
  // The accessory bar is React, so the view and the editor's focus are mirrored
  // into state: a StateField changing is not, by itself, a render.
  const [focused, setFocused] = useState(false);
  /** The user scrolled up, asking for the chrome back; typing hides it again. */
  const [revealed, setRevealed] = useState(false);
  const [view, setView] = useState<EditorView | null>(null);
  /** The scroller's height: the band and the tail below are fractions of it. */
  const [boxHeight, setBoxHeight] = useState(0);
  /**
   * When the editor's own box last moved. A scroll just after it is the caret
   * band settling into the new box, not the user — see `isUserScrollUp`.
   */
  const boxChangedAt = useRef(-Infinity);
  const attachments = useAttachments();
  const navHeight = usePhoneNavHeight();

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
        variantRoom.of(variantFacet.of(getVariant())),
        livePreview(),
        smartTyping(),
        syntaxHighlighting(mdHighlight),
        indexField.init(() => index),
        contextField.init(() => context),
        attachmentsField.init(() => attachments),
        wikilinkPlugin,
        wikilinkClick,
        peekLinkKey,
        wikilinkCompletion(),
        focusedField,
        focusTracking,
        daylogField,
        imageEmbedField,
        attachmentDrop,
        room.of([]),
        keymap.of([...defaultKeymap, ...historyKeymap, ...completionKeymap, indentWithTab]),
        placeholder ? cmPlaceholder(placeholder) : [],
        EditorView.updateListener.of((u) => {
          // `focusedField` and not `u.focusChanged`: the field is the editor's own
          // record of focus, so the bar and the daylog widgets agree on one answer.
          const now = u.state.field(focusedField, false) ?? false;
          if (now !== (u.startState.field(focusedField, false) ?? false)) setFocused(now);
          // Selecting text offers every Intake (ADR 0073); say so, since CodeMirror's selection is its own.
          if (u.selectionSet) u.view.dom.dispatchEvent(new CustomEvent(SELECTION_EVENT, { bubbles: true }));
          if (!u.docChanged) return;
          // Writing is the signal that the chrome is not wanted: whatever the
          // last scroll asked for, a keystroke puts the header away again.
          setRevealed(false);
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
    syncVariantFromUrl();
    const unsubscribeVariant = subscribeVariant(() => view.dispatch({ effects: variantRoom.reconfigure(variantFacet.of(getVariant())) }));
    if (view.state.facet(variantFacet) !== getVariant()) view.dispatch({ effects: variantRoom.reconfigure(variantFacet.of(getVariant())) });
    setView(view);
    // The editor loads lazily, so it can come up after the person has opened a popover or
    // dialog (the Journal's Jump to date on a Day just created): taking focus then would
    // close it under them. Focus is taken only when it is not in a layer outside the editor.
    const layer = document.activeElement?.closest('[role="dialog"]');
    if (autoFocus && !(layer && !layer.contains(host.current))) {
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
      unsubscribeVariant();
      view.destroy();
      viewRef.current = null;
      setView(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the editor is created once per mount; value/index/context are pushed via effects below
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

  // The band and the tail are fractions of the editor's own box, and the box moves
  // under it: the keyboard takes half the screen, the Fields strip folds open, the
  // phone turns. Observed rather than read once — a guessed height would put the
  // caret in the wrong place for as long as the keyboard is up.
  useEffect(() => {
    if (!view) return;
    const scroller = view.scrollDOM;
    const read = () =>
      setBoxHeight((prev) => {
        const next = scroller.clientHeight;
        // Stamped on a real change only: the observer also fires for widths and
        // for the resize that ends where it started, neither of which moves the
        // caret, and a stamp for those would swallow the user's next scroll.
        if (next !== prev) boxChangedAt.current = performance.now();
        return next;
      });
    const observer = new ResizeObserver(read);
    observer.observe(scroller);
    read();
    return () => observer.disconnect();
  }, [view]);

  // Scrolling *up* is how the header is asked back — the gesture is already the
  // one for "let me see where I am", and there is nothing to tap while the
  // header is away. Down is not the opposite: only typing puts it back.
  useEffect(() => {
    if (!view) return;
    const scroller = view.scrollDOM;
    let last = scroller.scrollTop;
    const onScroll = () => {
      const now = scroller.scrollTop;
      // Slack for the caret band's own nudge, and a settling window for the
      // bigger reflow that follows the box changing — the collapsing header
      // resizes the scroller for 200ms, and reading that as the user asking
      // brought the header back, which resized it again (the focused line
      // oscillated). `isUserScrollUp` holds both rules.
      if (isUserScrollUp(last, now, performance.now() - boxChangedAt.current)) setRevealed(true);
      last = now;
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, [view]);

  useEffect(() => {
    onQuietChangeRef.current?.(focused && !revealed);
    // Going away takes the chrome's reason to be hidden with it.
    return () => onQuietChangeRef.current?.(false);
  }, [focused, revealed]);

  // What covers the editor's foot is the accessory bar alone: the keyboard and the
  // phone nav need no room of their own, the frame ending above both (the nav
  // reserves the keyboard's strip, Chromium's viewport resize does it there).
  // The bar's height is what the caret must clear; the band is what it keeps
  // beyond that, and the tail is the blank space that lets the note's last lines
  // reach the same place instead of sitting under the bar unreachable.
  useEffect(() => {
    const covered = (isMobile && focused ? ACCESSORY_BAR_HEIGHT : 0) + (pillEnabled() ? PILL_ROOM : 0);
    const { top, bottom, tail } = caretRoom(boxHeight, covered);
    // New margins re-lay the caret out, which scrolls: the same settling window
    // the box gets, or the bar appearing on focus would read as the user asking
    // for the chrome back at the very moment it was being put away.
    boxChangedAt.current = performance.now();
    viewRef.current?.dispatch({
      effects: room.reconfigure([
        EditorView.scrollMargins.of(() => ({ top, bottom })),
        EditorView.contentAttributes.of({ style: `padding-bottom: ${tail}px` }),
      ]),
    });
  }, [isMobile, focused, boxHeight]);

  return (
    <>
      <div ref={host} className={cn("ll-editor min-h-0 flex-1", className)} />
      {isMobile && focused && view && <EditorAccessoryBar view={view} inset={inset} />}
      {/* PROTOTYPE #372: above the accessory bar (and the phone nav) when they show. */}
      <VariantPill bottom={isMobile ? (focused ? inset + ACCESSORY_BAR_HEIGHT : 0) + navHeight + 8 : 16} />
    </>
  );
}
