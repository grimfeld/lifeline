import { Link } from "react-router";
import { displayTitle, docHref, isVaultType, useAllDocuments, useDocumentTypes } from "@lifeline/core";
import { useMemo } from "react";

/**
 * /vault — the raw editor's landing (ADR 0068): the Vault is to bodies what a
 * Base is to fields, so it opens on nothing in particular — the tree is the
 * way in — with the bodies touched last a click away.
 */
export function VaultHome() {
  const docs = useAllDocuments();
  const types = useDocumentTypes();
  const recent = useMemo(() => {
    const defs = new Map(types.map((t) => [t.id, t]));
    return docs
      .filter((d) => {
        const def = defs.get(d.type);
        return def && (isVaultType(def) || (typeof d.body === "string" && d.body.trim() !== ""));
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 12);
  }, [docs, types]);
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4 p-6">
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Vault</h1>
        <p className="text-muted-foreground text-sm">
          Every body, as plain markdown with its frontmatter — for bulk edits, moves and fixes. Writing has its own places: the Journal, Notes, Research, Manuscript and
          Thoughts.
        </p>
      </div>
      {recent.length > 0 && (
        <section className="grid gap-1">
          <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Touched last</h2>
          {recent.map((d) => (
            <div key={d.id} className="hover:bg-accent flex min-w-0 items-center gap-2 rounded px-2 py-1 text-sm">
              <Link to={`/vault/d/${d.id}`} className="min-w-0 flex-1 truncate hover:underline">
                {displayTitle(d, types.find((t) => t.id === d.type))}
              </Link>
              <span className="text-muted-foreground max-w-1/3 truncate text-xs">{types.find((t) => t.id === d.type)?.label}</span>
              <Link to={docHref(d)} className="text-muted-foreground shrink-0 text-xs hover:underline">
                its page
              </Link>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
