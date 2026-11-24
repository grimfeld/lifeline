import { useEffect, useMemo, useState } from "react";
import { allAttachments, attachmentUrl, extractLinks, isImageEmbed, resolveAttachment, useAttachments } from "@lifeline/core";
import { cn } from "@lifeline/ui";

/**
 * The first image embedded in a Memory's body, fitted to the box it is given
 * (the grid's tile, later an Event's panel). While it is fetching it shows a
 * placeholder of that box's size; with no photo in the body, a name that
 * resolves to no Attachment, or its bytes gone, it renders nothing, so the
 * caller shows the title alone. The live Attachments list cannot tell "not
 * read yet" from "empty", so an unresolved name is confirmed by one read of
 * the store before it counts as missing: the placeholder shows meanwhile.
 */
export function MemoryPhoto({ body, className, onMissing }: { body: string | undefined; className?: string; onMissing?: () => React.ReactNode }) {
  const attachments = useAttachments();
  const name = useMemo(() => (body ? extractLinks(body).find(isImageEmbed)?.name : undefined), [body]);
  const att = useMemo(() => (name ? resolveAttachment(attachments, name) : undefined), [attachments, name]);
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [absent, setAbsent] = useState<string | null>(null);
  const attId = att?.id;
  const attFile = att?.file;
  useEffect(() => {
    setSrc(null);
    setFailed(false);
    if (!att) return;
    let alive = true;
    attachmentUrl(att)
      .then((u) => alive && setSrc(u))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the attachment's id and file: the record object is new on every read
  }, [attId, attFile]);
  useEffect(() => {
    if (!name || att) return;
    let alive = true;
    void allAttachments().then(
      (all) => alive && !resolveAttachment(all, name) && setAbsent(name),
      () => alive && setAbsent(name),
    );
    return () => {
      alive = false;
    };
  }, [name, att]);
  if (!name || failed || (!att && absent === name)) return <>{onMissing?.()}</>;
  if (!src) return <div className={cn("bg-muted animate-pulse", className)} role="img" aria-label="Loading photo" />;
  return <img src={src} alt="" className={cn("object-cover", className)} draggable={false} />;
}
