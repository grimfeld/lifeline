import { useEffect, useMemo, useState } from "react";
import { attachmentUrl, extractLinks, isImageEmbed, resolveAttachment, useAttachments } from "@lifeline/core";

/** The first image embedded in a Receipt's body — the photo it was read from (ADR 0045). */
export function ReceiptPhoto({ body, className }: { body: string | undefined; className?: string }) {
  const attachments = useAttachments();
  const name = useMemo(() => (body ? extractLinks(body).find(isImageEmbed)?.name : undefined), [body]);
  const att = useMemo(() => (name ? resolveAttachment(attachments, name) : undefined), [attachments, name]);
  const [src, setSrc] = useState<string | null>(null);
  const attId = att?.id;
  const attFile = att?.file;
  useEffect(() => {
    if (!att) return;
    let alive = true;
    attachmentUrl(att)
      .then((u) => alive && setSrc(u))
      .catch(() => alive && setSrc(null));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attId, attFile]);
  if (!name) return null;
  if (!src) return <div className={`text-muted-foreground text-xs ${className ?? ""}`}>{att ? "Loading photo…" : `Missing photo "${name}"`}</div>;
  return <img src={src} alt={name} className={`max-h-96 w-auto rounded-md border object-contain ${className ?? ""}`} draggable={false} />;
}

/** A not-yet-saved photo (the scan's file) shown from an object URL. */
export function PendingPhoto({ file, className }: { file: Blob; className?: string }) {
  const [url, setUrl] = useState<string>("");
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  if (!url) return null;
  return <img src={url} alt="Receipt" className={`max-h-96 w-auto rounded-md border object-contain ${className ?? ""}`} draggable={false} />;
}
