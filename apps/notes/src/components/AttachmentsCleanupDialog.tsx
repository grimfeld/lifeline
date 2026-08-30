import { useEffect, useMemo, useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, toast } from "@lifeline/ui";
import { deleteAttachment, orphanedAmong, pruneAttachmentBlobs, useAllDocuments, useAttachments, type Attachment } from "@lifeline/core";
import { Trash2 } from "lucide-react";

function kb(size: number): string {
  return size >= 1048576 ? `${(size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1024))} KB`;
}

/**
 * "Clean up unused Attachments" (ADR 0037): the orphaned Attachments — no
 * body embeds them any more — listed for deletion, one by one or all at
 * once. Nothing else ever deletes an Attachment.
 */
export function AttachmentsCleanupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const attachments = useAttachments();
  const docs = useAllDocuments();
  const orphans = useMemo(() => orphanedAmong(attachments, docs).sort((a, b) => a.name.localeCompare(b.name)), [attachments, docs]);
  const [busy, setBusy] = useState(false);
  // Bytes of Attachments deleted elsewhere are dropped while we are here anyway.
  useEffect(() => {
    if (open) void pruneAttachmentBlobs().catch(() => {});
  }, [open]);

  async function remove(list: Attachment[]) {
    setBusy(true);
    try {
      for (const a of list) await deleteAttachment(a.id);
      toast.success(list.length === 1 ? `“${list[0].name}” deleted` : `${list.length} attachments deleted`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const total = orphans.reduce((n, a) => n + (a.size || 0), 0);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Clean up unused attachments</DialogTitle>
        </DialogHeader>
        {orphans.length === 0 ? (
          <p className="text-muted-foreground text-sm">Every attachment is embedded somewhere. Nothing to clean up.</p>
        ) : (
          <>
            <p className="text-muted-foreground text-sm">
              {orphans.length} image{orphans.length === 1 ? "" : "s"} no note embeds any more · {kb(total)}
            </p>
            <ul className="max-h-72 divide-y overflow-y-auto rounded-md border text-sm">
              {orphans.map((a) => (
                <li key={a.id} className="flex items-center gap-2 px-2 py-1.5">
                  <span className="min-w-0 flex-1 truncate" title={a.name}>
                    {a.name}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">{kb(a.size || 0)}</span>
                  <Button size="icon" variant="ghost" className="size-7 shrink-0" aria-label={`Delete ${a.name}`} disabled={busy} onClick={() => void remove([a])}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {orphans.length > 0 && (
            <Button variant="destructive" disabled={busy} onClick={() => void remove(orphans)}>
              Delete all {orphans.length}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
