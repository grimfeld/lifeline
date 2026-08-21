import { useMemo } from "react";
import { useNavigate } from "react-router";
import { buildGraph, docHref, localGraph, useDocumentTypes, useLinkIndex, type CardProps, type GraphNode } from "@lifeline/core";
import { CardUnavailable, GraphView } from "@lifeline/ui";

/**
 * The Graph card (CONTEXT.md "Local graph"): one chosen Document's
 * neighbourhood on a Screen. Configured with a Document and a depth; a
 * Screen's Tag filter treats the card as one unit and never filters the
 * nodes inside it (ADR 0023).
 */
export function GraphCard({ settings, configure }: CardProps) {
  const navigate = useNavigate();
  const index = useLinkIndex();
  const types = useDocumentTypes();
  const docId = String(settings.doc ?? "");
  const depth: 1 | 2 = String(settings.depth) === "2" ? 2 : 1;
  const doc = docId ? index.byId.get(docId) : undefined;
  const model = useMemo(
    () => (doc ? localGraph(buildGraph(index, types, { orphans: true }), doc.id, depth) : { nodes: [], edges: [] }),
    [index, types, doc, depth],
  );
  if (!doc) return <CardUnavailable message="This Document is gone." onConfigure={configure} />;

  const open = (node: GraphNode) => {
    if (node.kind === "doc" && node.docId) {
      const d = index.byId.get(node.docId);
      if (d) navigate(docHref(d));
    }
  };

  return <GraphView nodes={model.nodes} edges={model.edges} onSelect={open} />;
}
