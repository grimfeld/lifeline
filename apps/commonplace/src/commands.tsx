import { pickLinked, type CommandDef, type CommandDialogProps } from "@lifeline/core";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@lifeline/ui";
import { NotebookPen, Quote as QuoteIcon, Radio } from "lucide-react";
import { CaptureForm, type CaptureMode } from "./components/CaptureForm";
import { allSources } from "./data/works";
import { addQuote } from "./data/quotes";
import { addNote } from "./data/notes";
import { addSource } from "./data/sources";
import { QUOTES_HREF, SHELF_HREF, SOURCE_KINDS, SOURCE_ROLE, isSourceKind } from "./domain/types";

function captureDialog(mode: CaptureMode, title: string) {
  return function CaptureDialog({ open, onOpenChange, initial }: CommandDialogProps) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <CaptureForm initialMode={mode} initial={initial} autoFocus onDone={() => onOpenChange(false)} onCancel={() => onOpenChange(false)} />
        </DialogContent>
      </Dialog>
    );
  };
}

const sourceArg = { key: "source", label: "Source", kind: "text" as const, required: true, hint: "Id or exact title of the Source — a book, film, album, game, article, podcast… (see commonplace_source_add to make one)." };

/** A Source named by id or exact title, among every Document playing the Role. */
async function pickSource(value: string): Promise<{ id: string; title: string }> {
  const sources = await allSources();
  const id = pickLinked({ key: "source", label: "Source", kind: "link", linkRole: SOURCE_ROLE }, value, sources);
  return { id, title: sources.find((s) => s.id === id)!.title };
}

export const commonplaceCommands: CommandDef[] = [
  {
    id: "commonplace.note-add",
    title: "Note on a source…",
    keywords: ["note", "notes", "source", "book", "podcast", "article", "film", "jot", "capture"],
    icon: NotebookPen,
    dialog: captureDialog("note", "Note on a source"),
    capture: true,
    args: [
      sourceArg,
      { key: "text", label: "Note", kind: "longtext", required: true, hint: "My words, in markdown. The first line becomes its title." },
      { key: "locator", label: "Where", kind: "text", hint: "Page, chapter, timestamp…" },
      { key: "tags", label: "Tags", kind: "list" },
    ],
    async invoke(a) {
      const source = await pickSource(a.source as string);
      const n = await addNote({ source: source.id, text: String(a.text), locator: a.locator as string | undefined, tags: a.tags as string[] | undefined });
      return { id: n.id, message: `Noted “${n.title}” on ${source.title}` };
    },
  },
  {
    // The id predates Sources (ADR 0024): agents know this tool by it.
    id: "commonplace.quote-add",
    title: "Quote from a source…",
    keywords: ["quote", "passage", "highlight", "clip", "clipping", "book", "film", "album", "article", "capture", "commonplace"],
    icon: QuoteIcon,
    dialog: captureDialog("quote", "Quote from a source"),
    capture: true,
    args: [
      sourceArg,
      { key: "text", label: "Quote", kind: "longtext", required: true, hint: "The passage, word for word." },
      { key: "locator", label: "Where", kind: "text", hint: "Page, timestamp, track…" },
      { key: "comment", label: "Comment", kind: "longtext" },
      { key: "tags", label: "Tags", kind: "list" },
    ],
    async invoke(a) {
      const source = await pickSource(a.source as string);
      const q = await addQuote({ source: source.id, text: String(a.text), locator: a.locator as string | undefined, comment: a.comment as string | undefined, tags: a.tags as string[] | undefined });
      return { id: q.id, message: `Quote kept from ${source.title}` };
    },
  },
  {
    id: "commonplace.source-add",
    title: "New source…",
    keywords: ["source", "article", "podcast", "episode", "video", "website", "paper", "talk"],
    icon: Radio,
    run: ({ navigate }) => navigate(SHELF_HREF),
    args: [
      { key: "title", label: "Name", kind: "text", required: true },
      { key: "kind", label: "Kind", kind: "select", options: SOURCE_KINDS.map((k) => ({ value: k.value, label: k.label })) },
      { key: "url", label: "URL", kind: "text" },
      { key: "author", label: "Author", kind: "text" },
      { key: "parent", label: "Part of", kind: "text", hint: "Id or exact title of the Source it belongs to — the show of an episode, the magazine of an article." },
    ],
    async invoke(a) {
      const parent = a.parent ? (await pickSource(a.parent as string)).id : "";
      const s = await addSource({ title: String(a.title), kind: isSourceKind(a.kind) ? a.kind : "", url: a.url as string | undefined, author: a.author as string | undefined, parent });
      return { id: s.id, message: `Source “${s.title}” added` };
    },
  },
  { id: "commonplace.open", title: "Go to Notes", keywords: ["notes", "sources", "shelf"], icon: NotebookPen, run: ({ navigate }) => navigate(SHELF_HREF) },
  { id: "commonplace.quotes", title: "Go to Quotes", keywords: ["quotes", "passages", "highlights", "commonplace"], icon: QuoteIcon, run: ({ navigate }) => navigate(QUOTES_HREF) },
];
