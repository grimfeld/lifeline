import { useState, type ReactNode } from "react";
import { useUnlinkedIn, type LinkIndex } from "@lifeline/core";
import { BacklinksSection, UnlinkedNamesSection, useOpenLinkRef } from "@lifeline/editor";
import { Button, Sheet, SheetContent, SheetTitle } from "@lifeline/ui";
import { Link2 } from "lucide-react";

/**
 * A Journal page's links (ADR 0068, amended): the unlinked names in its own
 * words, ready to link, then what links to it. Days are never mention targets,
 * so their unlinked mentions are always empty and not shown.
 */
export function JournalLinks({ docId, index, onFollow }: { docId: string; index: LinkIndex; /** After a link is followed (a sheet closes). */ onFollow?: () => void }) {
  const open = useOpenLinkRef(index);
  const onOpen: typeof open = (ref, name) => {
    onFollow?.();
    open(ref, name);
  };
  return (
    <div className="grid min-w-0 content-start gap-4 text-sm">
      <UnlinkedNamesSection docId={docId} index={index} />
      <BacklinksSection docId={docId} index={index} onOpen={onOpen} />
    </div>
  );
}

/**
 * Below `lg`, where the side column is hidden: a Links button (in the phone
 * dock on a phone) opening the same links in a bottom sheet, its badge
 * counting the names left to link.
 */
export function JournalLinksButton({ docId, index, children }: { docId: string; index: LinkIndex; /** More for the sheet, under the links (a period's Reports). */ children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const unlinked = useUnlinkedIn(index, docId).length;
  return (
    <>
      <Button size="icon" variant="ghost" className="relative size-7 shrink-0 lg:hidden" onClick={() => setOpen(true)} aria-label={unlinked ? `Links, ${unlinked} unlinked` : "Links"} title="Links">
        <Link2 />
        {unlinked > 0 && <span className="bg-primary text-primary-foreground absolute -top-1 -right-1 min-w-4 rounded-full px-1 text-[10px] leading-4 tabular-nums">{unlinked}</span>}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" aria-describedby={undefined} className="max-h-[80vh]">
          <SheetTitle>Links</SheetTitle>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <JournalLinks docId={docId} index={index} onFollow={() => setOpen(false)} />
            {children && <div className="mt-4 grid min-w-0 gap-4 text-sm" onClickCapture={(e) => (e.target as HTMLElement).closest("a,button") && setOpen(false)}>{children}</div>}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
