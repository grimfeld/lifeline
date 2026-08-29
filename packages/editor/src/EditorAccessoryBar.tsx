import { createPortal } from "react-dom";
import { EditorView, type Command } from "@codemirror/view";
import { cursorCharLeft, cursorCharRight, indentLess, indentMore, redo, undo } from "@codemirror/commands";
import {
  Bold,
  ChevronLeft,
  ChevronRight,
  Code,
  Hash,
  Heading,
  Italic,
  Link2,
  List,
  ListIndentDecrease,
  ListIndentIncrease,
  ListTodo,
  Redo2,
  Strikethrough,
  TextQuote,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { cycleHeading, insertText, insertWikilink, toggleBullet, toggleQuote, toggleTask, wrapWith } from "./mdCommands";

type Key = { label: string; icon: LucideIcon; run: Command };

/**
 * Leftmost is nearest the thumb, so the two things a phone genuinely cannot do
 * otherwise lead: placing the caret by a character, and linking. The markdown
 * marks follow in the order they get used; undo/redo close the row.
 */
const KEYS: Key[] = [
  { label: "Left", icon: ChevronLeft, run: cursorCharLeft },
  { label: "Right", icon: ChevronRight, run: cursorCharRight },
  { label: "Link a note", icon: Link2, run: insertWikilink },
  { label: "Tag", icon: Hash, run: insertText("#") },
  { label: "Heading", icon: Heading, run: cycleHeading },
  { label: "Bold", icon: Bold, run: wrapWith("**") },
  { label: "Italic", icon: Italic, run: wrapWith("*") },
  { label: "Strikethrough", icon: Strikethrough, run: wrapWith("~~") },
  { label: "Code", icon: Code, run: wrapWith("`") },
  { label: "Bullet", icon: List, run: toggleBullet },
  { label: "Task", icon: ListTodo, run: toggleTask },
  { label: "Quote", icon: TextQuote, run: toggleQuote },
  { label: "Outdent", icon: ListIndentDecrease, run: indentLess },
  { label: "Indent", icon: ListIndentIncrease, run: indentMore },
  { label: "Undo", icon: Undo2, run: undo },
  { label: "Redo", icon: Redo2, run: redo },
];

/** The bar's own height, in px — the editor keeps this much scroll margin below the caret. */
export const ACCESSORY_BAR_HEIGHT = 44;

/**
 * The strip of markdown actions that rides above the phone's keyboard while the
 * editor has focus (ADR 0021 amendment). Portalled to `body`: a `fixed` element
 * is trapped by any transformed ancestor, and the editor sits inside sheets.
 *
 * `inset` is where the keyboard's top edge is — see `useKeyboardInset`. It is 0
 * when the layout viewport already stops there, which is also the right `bottom`.
 */
export function EditorAccessoryBar({ view, inset }: { view: EditorView; inset: number }) {
  return createPortal(
    <div
      className="bg-background/95 fixed inset-x-0 z-50 border-t backdrop-blur-sm md:hidden"
      style={{ bottom: inset, paddingBottom: inset > 0 ? undefined : "env(safe-area-inset-bottom)" }}
      role="toolbar"
      aria-label="Markdown actions"
    >
      <div className="flex gap-0.5 overflow-x-auto px-1 py-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {KEYS.map(({ label, icon: Icon, run }) => (
          <button
            key={label}
            type="button"
            aria-label={label}
            title={label}
            className="text-muted-foreground active:bg-accent active:text-accent-foreground flex size-10 shrink-0 items-center justify-center rounded-md"
            // The tap must not take focus: a blur closes the keyboard and drops
            // the selection these commands act on. Both events — Safari still
            // synthesises the mouse one from the touch.
            onPointerDown={(e) => e.preventDefault()}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              run(view);
              view.focus();
            }}
          >
            <Icon className="size-5" />
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}
