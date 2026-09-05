import { useParams } from "react-router";
import { DocumentEditor } from "@lifeline/editor";
import { Button } from "@lifeline/ui";
import { Lock } from "lucide-react";
import { openPrivateDialog, useDocument, useDocumentType, useIsMobile, useLinkIndex, usePrivateLockedRefs } from "@lifeline/core";

/** Breadcrumb of a Document's folder path. */
export function Breadcrumb({ folder }: { folder: string }) {
  const parts = folder ? folder.split("/") : [];
  return (
    <div className="text-muted-foreground flex min-w-0 items-center gap-1 truncate text-xs">
      <span>/</span>
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-1">
          <span>{p}</span>
          <span>/</span>
        </span>
      ))}
    </div>
  );
}

/** The Vault's generic page for any Document (/vault/d/:id): breadcrumb + the generic editor. */
export function VaultDocPage() {
  const { id } = useParams<{ id: string }>();
  const doc = useDocument(id);
  const def = useDocumentType(doc?.type);
  const index = useLinkIndex();
  const locked = usePrivateLockedRefs();
  const isMobile = useIsMobile();
  if (!doc && id && locked.ids.has(id)) {
    // Behind the gate (ADR 0038): say so and offer to unlock, never "not found".
    return (
      <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-3 text-sm">
        <Lock className="size-6" />
        <span>This Document is in Private.</span>
        <Button size="sm" onClick={() => openPrivateDialog("unlock")}>
          Unlock…
        </Button>
      </div>
    );
  }
  if (!doc) return <div className="text-muted-foreground flex h-full items-center justify-center text-sm">Document not found.</div>;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-1.5">
        <div className="ml-auto">
          <Breadcrumb folder={doc.folder} />
        </div>
      </div>
      {/* No autoFocus on a phone (ADR 0021): a Document is opened to read as
          often as to write, and a keyboard covering half the screen uninvited is
          the wrong default. Tapping the text opens it. */}
      <DocumentEditor key={doc.id} doc={doc} def={def} index={index} autoFocus={!isMobile} />
    </div>
  );
}
