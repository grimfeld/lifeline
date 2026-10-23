import { useEffect, useMemo, useState } from "react";
import { Button, ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, toast } from "@lifeline/ui";
import { attachmentUrl, renameAttachment, resolveAttachment, useAttachments } from "@lifeline/core";
import "./editor.css";

/**
 * One embedded Attachment (ADR 0037): the image rendered from its cached
 * bytes, with the context menu that is the Attachment's only handle —
 * Rename (rewrites every embed), Copy embed, Open original. Shared by the
 * editor's inline widget and reading mode. Spans throughout: reading mode
 * mounts it inside a paragraph.
 */
export function AttachmentImage({ name }: { name: string }) {
  const attachments = useAttachments();
  const att = useMemo(() => resolveAttachment(attachments, name), [attachments, name]);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");
  const attId = att?.id;
  const attFile = att?.file;

  useEffect(() => {
    if (!att) return;
    let alive = true;
    setError(null);
    attachmentUrl(att)
      .then((u) => alive && setSrc(u))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
    // The URL depends on the record's identity and on whether its bytes have reached the server.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attId, attFile]);

  if (!att) {
    return (
      <span className="attachment-missing" title="No Attachment carries this name">
        Missing image “{name}”
      </span>
    );
  }

  async function submitRename() {
    const next = draft.trim();
    setRenaming(false);
    if (!next || !att) return;
    try {
      await renameAttachment(att, next);
      toast.success(`Renamed to “${next}”`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {src ? (
            <img src={src} alt={att.name} title={att.name} className="attachment-image" draggable={false} />
          ) : (
            <span className="attachment-loading">{error ? `${error} — ${att.name}` : `Loading ${att.name}…`}</span>
          )}
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            onClick={() => {
              setDraft(att.name);
              setRenaming(true);
            }}
          >
            Rename…
          </ContextMenuItem>
          <ContextMenuItem onClick={() => void navigator.clipboard?.writeText(`![[${att.name}]]`).then(() => toast.success("Embed copied"))}>Copy embed</ContextMenuItem>
          <ContextMenuItem disabled={!src} onClick={() => src && window.open(src, "_blank", "noopener")}>
            Open original
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename image</DialogTitle>
          </DialogHeader>
          <Input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void submitRename()} aria-label="New name" />
          <p className="text-muted-foreground text-xs">Every note embedding it is rewritten.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenaming(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submitRename()} disabled={!draft.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
