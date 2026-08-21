import { useMemo, useState } from "react";
import { buildGraph, localGraph, useDocumentTypes, type LinkIndex, type LinkRef } from "@lifeline/core";
import { cn, GraphView } from "@lifeline/ui";

/**
 * The Local graph panel (CONTEXT.md): the open Document's neighbourhood —
 * links, backlinks and Ghost nodes — beside the linked mentions. Depth 1 by
 * default, toggleable to 2.
 */
export function LocalGraphPanel({ docId, index, onOpen }: { docId: string; index: LinkIndex; onOpen: (ref: LinkRef, name: string) => void }) {
  const types = useDocumentTypes();
  const [depth, setDepth] = useState<1 | 2>(1);
  const model = useMemo(() => localGraph(buildGraph(index, types, { orphans: true }), docId, depth), [index, types, docId, depth]);
  if (model.nodes.length <= 1) return null;
  return (
    <section>
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Graph</h3>
        <div className="flex gap-0.5">
          {([1, 2] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDepth(d)}
              aria-pressed={depth === d}
              className={cn("rounded border px-1.5 text-[10px] tabular-nums", depth === d ? "bg-accent" : "text-muted-foreground opacity-60")}
            >
              {d}
            </button>
          ))}
        </div>
      </div>
      <div className="h-44 overflow-hidden rounded-md border">
        <GraphView
          nodes={model.nodes}
          edges={model.edges}
          onSelect={(n) => {
            if (n.kind === "doc" && n.id.startsWith("d:")) {
              const id = n.id.slice(2);
              onOpen({ kind: "doc", id, type: index.byId.get(id)?.type ?? "" }, n.label);
            } else if (n.kind === "ghost") {
              onOpen({ kind: "unresolved", name: n.label }, n.label);
            }
          }}
        />
      </div>
    </section>
  );
}
