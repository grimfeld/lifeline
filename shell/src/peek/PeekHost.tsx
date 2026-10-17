import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { Button, Sheet, SheetClose, SheetContent, SheetTitle } from "@lifeline/ui";
import { MarkdownView } from "@lifeline/editor";
import {
  closePeek,
  displayTitle,
  docHref,
  homeModuleOf,
  moduleById,
  singularOf,
  useDocument,
  useDocumentType,
  useIsMobile,
  useLinkIndex,
  usePeekedId,
  vaultDocPath,
  type Document,
  type DocumentTypeDef,
  fieldsOfDocument,
} from "@lifeline/core";
import { ArrowUpRight, NotebookPen, X } from "lucide-react";

/**
 * The **Peek** (ADR 0057): one Document opened where the user is — over the
 * Vault, a general Surface, a Base, another Module — so that following a link
 * never throws them out of what they were doing. The body is the owning App's
 * (`DocumentTypeDef.peek`) or, failing one, Core's plain fields; the frame is
 * Core's, with the ways through: to the Document's Home Module, and to the
 * Vault where its body is written.
 *
 * A side panel on the desk, a bottom sheet on the phone. Mounted once.
 */
export function PeekHost() {
  const id = usePeekedId();
  const doc = useDocument(id ?? undefined);
  const def = useDocumentType(doc?.type);
  const isMobile = useIsMobile();
  const location = useLocation();

  // Going anywhere closes it: the Peek belongs to the place it was opened over.
  useEffect(() => {
    closePeek();
  }, [location.pathname]);

  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && closePeek()}>
      <SheetContent
        aria-describedby={undefined}
        side={isMobile ? "bottom" : "right"}
        className={isMobile ? "max-h-[80dvh] gap-0 p-0" : "w-full gap-0 p-0 sm:max-w-md"}
      >
        {doc ? (
          <PeekBody doc={doc} def={def} />
        ) : (
          <>
            <SheetTitle className="sr-only">Peek</SheetTitle>
            <p className="text-muted-foreground p-6 text-sm">This document is gone.</p>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function PeekBody({ doc, def }: { doc: Document; def: DocumentTypeDef | undefined }) {
  const navigate = useNavigate();
  const home = moduleById(homeModuleOf(doc));
  const href = docHref(doc, def);
  const vault = vaultDocPath(doc.id);
  const writable = def?.body !== "none";
  const Icon = def?.icon;
  const AppPeek = def?.peek;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative flex flex-col gap-1 border-b px-4 pt-4 pb-3 pr-10">
        <SheetClose asChild>
          <Button variant="ghost" size="icon" className="absolute top-2 right-2 size-8" title="Close">
            <X />
          </Button>
        </SheetClose>
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          {Icon && <Icon className="size-3.5" />}
          {def ? singularOf(def) : doc.type}
          {home && <span>· {home.title}</span>}
        </div>
        <SheetTitle className="px-0 pt-0 text-base leading-snug">{displayTitle(doc, def)}</SheetTitle>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{AppPeek ? <AppPeek doc={doc} /> : <GenericPeek doc={doc} def={def} />}</div>
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

/** Core's Peek for a type whose App brings none: the plain fields, and the body read-only. */
function GenericPeek({ doc, def }: { doc: Document; def: DocumentTypeDef | undefined }) {
  const index = useLinkIndex();
  const fields = fieldsOfDocument(doc, def).filter((f) => !f.hidden && doc[f.key] !== undefined && doc[f.key] !== null && doc[f.key] !== "");
  const body = typeof doc.body === "string" ? doc.body : "";
  return (
    <div className="flex flex-col gap-3">
      {fields.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          {fields.map((f) => (
            <div key={f.key} className="contents">
              <dt className="text-muted-foreground">{f.label}</dt>
              <dd className="min-w-0 break-words">{formatValue(doc[f.key])}</dd>
            </div>
          ))}
        </dl>
      )}
      {doc.tags && doc.tags.length > 0 && <div className="text-muted-foreground text-xs">{doc.tags.map((t) => `#${t}`).join(" ")}</div>}
      {body && <MarkdownView body={body} index={index} compact docDate={doc.type === "daily" ? doc.title : null} origin={doc.id} />}
      {fields.length === 0 && !body && <p className="text-muted-foreground text-sm">Nothing more to show here.</p>}
    </div>
  );
}

function formatValue(v: unknown): string {
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}
