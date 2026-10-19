import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Button, Sheet, SheetClose, SheetContent, SheetTitle, Tip, cn } from "@lifeline/ui";
import {
  backPeek,
  closePeek,
  InPeekContext,
  displayTitle,
  docHref,
  homeModuleOf,
  isModShortcut,
  moduleById,
  singularOf,
  useDocument,
  useDocumentType,
  useIsMobile,
  usePeekedId,
  usePeekStack,
  vaultDocPath,
  type Document,
  type DocumentTypeDef,
} from "@lifeline/core";
import { ArrowLeft, ArrowUpRight, BookOpen, NotebookPen, Pencil, X } from "lucide-react";
import { PeekContent } from "./PeekContent";

/**
 * The **Peek** (ADR 0057): one Document opened where the user is — over the
 * Vault, a general Surface, a Base, another Module — so that following a link
 * never throws them out of what they were doing. What it shows is
 * `PeekContent`'s (the owner's part and the user's own Fields, ADR 0085); the frame is
 * Core's, with the ways through: to the Document's Home Module, and to the
 * Vault where its body is written.
 *
 * Following a link inside it replaces what it shows, with a back control in
 * its header (ADR 0085): a Peek never opens over another Peek.
 *
 * Its body is read until the user asks to write it — ✎ in the header, or
 * `⌘E` inside the Peek — and then written with the Vault's editor. Writing is
 * the Document's: it ends when the Peek closes or moves to another one, so a
 * Peek always opens to read. While writing, the panel widens on the desk (the
 * page behind still shows) and the sheet takes the phone's whole height.
 *
 * A side panel on the desk, a bottom sheet on the phone. Mounted once.
 */
export function PeekHost() {
  const id = usePeekedId();
  const doc = useDocument(id ?? undefined);
  const def = useDocumentType(doc?.type);
  const isMobile = useIsMobile();
  const location = useLocation();
  /** The Document whose body is being written; any other (or none) is read. */
  const [writingId, setWritingId] = useState<string | null>(null);
  const writable = !!doc && def?.body !== "none";
  const writing = writable && writingId === doc.id;
  const toggleWriting = () => doc && setWritingId(writing ? null : doc.id);

  // Going anywhere closes it: the Peek belongs to the place it was opened over.
  useEffect(() => {
    closePeek();
  }, [location.pathname]);
  // Closed, it opens to read next time — even on the same Document.
  useEffect(() => {
    if (!id) setWritingId(null);
  }, [id]);

  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && closePeek()}>
      <SheetContent
        aria-describedby={undefined}
        side={isMobile ? "bottom" : "right"}
        className={
          isMobile
            ? cn("gap-0 p-0", writing ? "h-dvh max-h-dvh rounded-t-none" : "max-h-[80dvh]")
            : cn("w-full gap-0 p-0", writing ? "sm:max-w-2xl" : "sm:max-w-md")
        }
        // The Peek's own ⌘E: the page's editor behind it leaves a key from in here alone.
        onKeyDown={(e) => {
          if (writable && isModShortcut(e.nativeEvent, "e")) {
            e.preventDefault();
            toggleWriting();
          }
        }}
      >
        {/* Links followed in here replace what the Peek shows (ADR 0085). */}
        <InPeekContext.Provider value={true}>
          {doc ? (
            <PeekBody key={doc.id} doc={doc} def={def} writing={writing} onToggleWriting={writable ? toggleWriting : undefined} />
          ) : (
            <>
              <div className="absolute top-2 right-10">
                <PeekBack />
              </div>
              <SheetTitle className="sr-only">Peek</SheetTitle>
              <p className="text-muted-foreground p-6 text-sm">This document is gone.</p>
            </>
          )}
        </InPeekContext.Provider>
      </SheetContent>
    </Sheet>
  );
}

function PeekBody({ doc, def, writing, onToggleWriting }: { doc: Document; def: DocumentTypeDef | undefined; writing: boolean; onToggleWriting?: () => void }) {
  const navigate = useNavigate();
  const home = moduleById(homeModuleOf(doc));
  const href = docHref(doc, def);
  const vault = vaultDocPath(doc.id);
  const writable = def?.body !== "none";
  const Icon = def?.icon;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative flex flex-col gap-1 border-b px-4 pt-4 pb-3 pr-26">
        <div className="absolute top-2 right-2 flex items-center">
          <PeekBack />
          {onToggleWriting && (
            <Tip label={writing ? "Read (⌘E)" : "Write (⌘E)"}>
              <Button variant="ghost" size="icon" className="size-8" aria-label={writing ? "Read" : "Write"} aria-pressed={writing} onClick={onToggleWriting}>
                {writing ? <BookOpen /> : <Pencil />}
              </Button>
            </Tip>
          )}
          <SheetClose asChild>
            <Button variant="ghost" size="icon" className="size-8" title="Close">
              <X />
            </Button>
          </SheetClose>
        </div>
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          {Icon && <Icon className="size-3.5" />}
          {def ? singularOf(def) : doc.type}
          {home && <span>· {home.title}</span>}
        </div>
        <SheetTitle className="px-0 pt-0 text-base leading-snug">{displayTitle(doc, def)}</SheetTitle>
      </div>
      <div className={cn("min-h-0 flex-1 overflow-y-auto px-4 py-3", writing && "flex flex-col")}>
        <PeekContent doc={doc} def={def} writing={writing} />
      </div>
      <div className="flex flex-wrap gap-2 border-t px-4 py-3">
        <Button size="sm" onClick={() => navigate(href)}>
          <ArrowUpRight /> {home ? `Open in ${home.title}` : "Open"}
        </Button>
        {writable && href !== vault && (
          <Button size="sm" variant="outline" onClick={() => navigate(vault)}>
            <NotebookPen /> Write in the Vault
          </Button>
        )}
      </div>
    </div>
  );
}

/** Back to what the Peek showed before a link was followed in it; only there when there is a before. */
function PeekBack() {
  const stack = usePeekStack();
  if (stack.length < 2) return null;
  return (
    <Tip label="Back">
      <Button variant="ghost" size="icon" className="size-8" aria-label="Back" onClick={backPeek}>
        <ArrowLeft />
      </Button>
    </Tip>
  );
}
