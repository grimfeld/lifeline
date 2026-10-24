import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Input } from "@lifeline/ui";
import { aliasesOf, displayTitle, docHref, docPath, documentType, formatHuman, singularOf } from "@lifeline/core";
import { Search } from "lucide-react";
import { useVaultDocs } from "./useVaultDocs";

/** Full-text search over titles, aliases and bodies of every Vault Document, with a match snippet. Client-side. */
export function SearchPane() {
  const notes = useVaultDocs();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    const out: { id: string; title: string; path: string; snippet: string; type: string }[] = [];
    for (const n of notes) {
      const def = documentType(n.type);
      const aliases = aliasesOf(n, def).join(" ");
      const content = typeof n.body === "string" ? n.body : "";
      const hay = `${displayTitle(n, def)}\n${aliases}\n${content}`;
      const i = hay.toLowerCase().indexOf(query);
      if (i === -1) continue;
      const ci = content.toLowerCase().indexOf(query);
      const snippet = ci === -1 ? "" : content.slice(Math.max(0, ci - 40), ci + query.length + 60).replace(/\s+/g, " ");
      out.push({ id: n.id, title: n.type === "daily" ? formatHuman(n.title) : displayTitle(n, def), path: docPath({ folder: n.folder, title: displayTitle(n, def) }), snippet, type: def ? singularOf(def) : n.type });
      if (out.length >= 100) break;
    }
    return out;
  }, [q, notes]);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative p-2">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-3.5 -translate-y-1/2" />
        <Input aria-label="Search the Vault" className="pl-8" placeholder="Search the Vault…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto px-1 pb-4">
        {q && results.length === 0 && <li className="text-muted-foreground px-2 py-3 text-xs">No matches.</li>}
        {results.map((r) => {
          const n = notes.find((x) => x.id === r.id)!;
          return (
            <li key={r.id}>
              <button type="button" className="hover:bg-accent/60 w-full rounded-md px-2 py-1 text-left" onClick={() => navigate(docHref(n))}>
                <div className="truncate text-sm">{r.title}</div>
                <div className="text-muted-foreground truncate text-2xs">{r.path} · {r.type}</div>
                {r.snippet && <div className="text-muted-foreground line-clamp-2 text-xs">…{r.snippet}…</div>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
