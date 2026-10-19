import { useDeferredValue, useMemo } from "react";
import { appById } from "../registry";
import { normalizeName } from "../markdown";
import { displayTitle, isLinkKind, type DocumentTypeDef } from "./types";
import { useDocumentTypes } from "./registry";
import { useLinkIndex, type LinkIndex } from "./links";

/**
 * The Graph model (ADR 0023): Linkable Documents as nodes, link relations —
 * body wikilinks and Link fields, merged per pair, undirected — as edges.
 * Ghost nodes stand for unresolved names; Tags may join as nodes. Pure
 * derivation over the LinkIndex; nothing here is stored.
 */

export type GraphNodeKind = "doc" | "ghost" | "tag";

export interface GraphNode {
  /** `d:<docId>`, `g:<normalised name>` or `t:<tag>` — unique across kinds. */
  id: string;
  kind: GraphNodeKind;
  label: string;
  /** Document type id (doc nodes). */
  type?: string;
  /** Document id (doc nodes). */
  docId?: string;
  /** Owning App's accent color (doc nodes; CSS value, may be a var()). */
  color?: string;
  /** Count of merged edges touching this node. */
  degree: number;
}

export interface GraphEdge {
  /** Node ids. */
  source: string;
  target: string;
  /** Merged mention count (>= 1). */
  weight: number;
}

export interface GraphModel {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphOptions {
  /** Ghost nodes for unresolved names (default true). */
  ghosts?: boolean;
  /** Tags as nodes, connected to the Linkable Documents carrying them (default false). */
  tags?: boolean;
  /** Keep Documents with no edges (default false — Bases already show everything). */
  orphans?: boolean;
  /** Document type ids to leave out entirely. */
  hiddenTypes?: ReadonlySet<string>;
  /** Tag filter (ADR 0014 semantics): a Document passes if it carries any of these; untagged never passes a non-empty filter. */
  tagFilter?: readonly string[];
  /** An App's lens (ADR 0032): keep only Documents of these types and whatever is one edge away from them. */
  focusTypes?: ReadonlySet<string>;
}

function isLinkable(def: DocumentTypeDef | undefined): boolean {
  return !!def && !def.internal && !!def.linkable;
}

/** Build the whole Graph from the link index. Pure. */
export function buildGraph(index: LinkIndex, types: DocumentTypeDef[], opts: GraphOptions = {}): GraphModel {
  const { ghosts = true, tags = false, orphans = false, hiddenTypes, tagFilter, focusTypes } = opts;
  const defs = new Map(types.map((t) => [t.id, t]));

  let tagged: Set<string> | null = null;
  if (tagFilter && tagFilter.length > 0) {
    tagged = new Set();
    for (const t of tagFilter) for (const id of index.tags.get(t) ?? []) tagged.add(id);
  }

  const docNodes = new Map<string, GraphNode>(); // docId → node
  for (const d of index.docs) {
    const def = defs.get(d.type);
    if (!isLinkable(def) || hiddenTypes?.has(d.type)) continue;
    if (tagged && !tagged.has(d.id)) continue;
    docNodes.set(d.id, {
      id: `d:${d.id}`,
      kind: "doc",
      label: displayTitle(d, def),
      type: d.type,
      docId: d.id,
      color: def?.appId ? appById(def.appId)?.color : undefined,
      degree: 0,
    });
  }

  // Merged undirected edges: one per node pair, weight = mention count.
  const edges = new Map<string, GraphEdge>();
  const addEdge = (a: string, b: string) => {
    if (a === b) return;
    const key = a < b ? `${a} ${b}` : `${b} ${a}`;
    const cur = edges.get(key);
    if (cur) cur.weight += 1;
    else edges.set(key, { source: a, target: b, weight: 1 });
  };

  // Backlinks carry every stored relation — body wikilinks and Link fields —
  // so walking targets' backlinks covers all doc-to-doc edges exactly once.
  for (const [docId, target] of docNodes) {
    for (const b of index.backlinksTo(docId)) {
      const source = docNodes.get(b.sourceId);
      if (source) addEdge(source.id, target.id);
    }
  }

  const extraNodes: GraphNode[] = [];
  if (ghosts) {
    for (const [name, sourceIds] of index.unresolved) {
      const node: GraphNode = { id: `g:${name}`, kind: "ghost", label: name, degree: 0 };
      let touched = false;
      for (const sid of sourceIds) {
        const source = docNodes.get(sid);
        if (!source) continue;
        addEdge(source.id, node.id);
        touched = true;
      }
      if (touched) extraNodes.push(node);
    }
  }
  if (tags) {
    for (const [tag, docIds] of index.tags) {
      const node: GraphNode = { id: `t:${tag}`, kind: "tag", label: `#${tag}`, degree: 0 };
      let touched = false;
      for (const did of new Set(docIds)) {
        const source = docNodes.get(did);
        if (!source) continue;
        addEdge(source.id, node.id);
        touched = true;
      }
      if (touched) extraNodes.push(node);
    }
  }

  const byId = new Map<string, GraphNode>();
  for (const n of docNodes.values()) byId.set(n.id, n);
  for (const n of extraNodes) byId.set(n.id, n);
  const edgeList = [...edges.values()];
  for (const e of edgeList) {
    byId.get(e.source)!.degree += 1;
    byId.get(e.target)!.degree += 1;
  }

  // A non-empty tag filter is an explicit selection: keep its Documents even
  // when the filter cut their edges away — otherwise filtering often shows nothing.
  let nodes = [...byId.values()].filter((n) => orphans || tagged !== null || n.degree > 0 || n.kind !== "doc");
  let finalEdges = edgeList;
  if (focusTypes && focusTypes.size > 0) {
    const keep = new Set<string>();
    for (const n of nodes) if (n.kind === "doc" && n.type && focusTypes.has(n.type)) keep.add(n.id);
    for (const e of edgeList) {
      if (keep.has(e.source)) keep.add(e.target);
      else if (keep.has(e.target)) keep.add(e.source);
    }
    nodes = nodes.filter((n) => keep.has(n.id));
    finalEdges = edgeList.filter((e) => keep.has(e.source) && keep.has(e.target));
  }
  return { nodes, edges: finalEdges };
}

/**
 * The depth-limited neighbourhood of one Document within a built Graph
 * (CONTEXT.md "Local graph"). The centre is kept even as an orphan — build
 * the source model with `orphans: true` so a centre with no links still shows.
 */
export function localGraph(model: GraphModel, docId: string, depth: 1 | 2): GraphModel {
  const center = `d:${docId}`;
  const adjacency = new Map<string, string[]>();
  const adj = (id: string): string[] => {
    let list = adjacency.get(id);
    if (!list) adjacency.set(id, (list = []));
    return list;
  };
  for (const e of model.edges) {
    adj(e.source).push(e.target);
    adj(e.target).push(e.source);
  }
  const keep = new Set<string>([center]);
  let frontier = [center];
  for (let d = 0; d < depth; d++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const n of adjacency.get(id) ?? []) {
        if (keep.has(n)) continue;
        keep.add(n);
        next.push(n);
      }
    }
    frontier = next;
  }
  const nodes = model.nodes.filter((n) => keep.has(n.id));
  const present = new Set(nodes.map((n) => n.id));
  const edges = model.edges.filter((e) => present.has(e.source) && present.has(e.target));
  const degree = new Map<string, number>();
  for (const e of edges) {
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
  }
  return { nodes: nodes.map((n) => ({ ...n, degree: degree.get(n.id) ?? 0 })), edges };
}

/**
 * The Local graph built straight from the index — the same model as
 * `localGraph(buildGraph(index, types, { orphans: true }), docId, depth)`,
 * but walking only the centre's neighbourhood through backlinks, outgoing
 * links and Ghosts instead of building the whole vault's Graph first (the
 * links panel rebuilt it on every save).
 */
export function buildLocalGraph(index: LinkIndex, types: DocumentTypeDef[], docId: string, depth: 1 | 2): GraphModel {
  const defs = new Map(types.map((t) => [t.id, t]));
  const nodes = new Map<string, GraphNode>(); // node id → node, for the kept ones
  const isDoc = (id: string) => isLinkable(defs.get(index.byId.get(id)?.type ?? ""));
  const docNode = (id: string): GraphNode => {
    const d = index.byId.get(id)!;
    const def = defs.get(d.type);
    return { id: `d:${d.id}`, kind: "doc", label: displayTitle(d, def), type: d.type, docId: d.id, color: def?.appId ? appById(def.appId)?.color : undefined, degree: 0 };
  };
  if (!isDoc(docId)) return { nodes: [], edges: [] };

  /** The node ids one edge away — the relations `buildGraph` draws, read from either end. */
  const neighbours = (nodeId: string): string[] => {
    if (nodeId.startsWith("g:")) return (index.unresolved.get(nodeId.slice(2)) ?? []).filter(isDoc).map((s) => `d:${s}`);
    const id = nodeId.slice(2);
    const out = index.backlinksTo(id).filter((b) => isDoc(b.sourceId)).map((b) => `d:${b.sourceId}`);
    // Outgoing: body links and Link fields. A target counts only when its
    // backlinks name this Document — what the index stored, as buildGraph reads it.
    const d = index.byId.get(id)!;
    const targets = new Set<string>();
    for (const { ref } of index.linksFrom(id)) {
      if (ref.kind === "doc") targets.add(ref.id);
      else if (ref.kind === "unresolved") {
        const k = normalizeName(ref.name);
        if (index.unresolved.get(k)?.includes(id)) out.push(`g:${k}`);
      }
    }
    for (const f of defs.get(d.type)?.fields ?? []) {
      if (!isLinkKind(f.kind)) continue;
      const v = d[f.key];
      for (const t of Array.isArray(v) ? v : [v]) if (typeof t === "string" && t) targets.add(t);
    }
    for (const t of targets) if (t !== id && isDoc(t) && index.backlinksTo(t).some((b) => b.sourceId === id)) out.push(`d:${t}`);
    return out;
  };

  const center = `d:${docId}`;
  const keep = new Set<string>([center]);
  let frontier = [center];
  for (let step = 0; step < depth; step++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const n of neighbours(id)) {
        if (keep.has(n)) continue;
        keep.add(n);
        next.push(n);
      }
    }
    frontier = next;
  }
  for (const id of keep) nodes.set(id, id.startsWith("g:") ? { id, kind: "ghost", label: id.slice(2), degree: 0 } : docNode(id.slice(2)));

  // Every edge among the kept nodes, merged and weighted as buildGraph does.
  const edges = new Map<string, GraphEdge>();
  const addEdge = (a: string, b: string) => {
    if (a === b || !keep.has(a) || !keep.has(b)) return;
    const key = a < b ? `${a} ${b}` : `${b} ${a}`;
    const cur = edges.get(key);
    if (cur) cur.weight += 1;
    else edges.set(key, { source: a, target: b, weight: 1 });
  };
  for (const id of keep) {
    if (id.startsWith("g:")) for (const s of index.unresolved.get(id.slice(2)) ?? []) addEdge(`d:${s}`, id);
    else for (const b of index.backlinksTo(id.slice(2))) addEdge(`d:${b.sourceId}`, id);
  }
  const edgeList = [...edges.values()];
  for (const e of edgeList) {
    nodes.get(e.source)!.degree += 1;
    nodes.get(e.target)!.degree += 1;
  }
  return { nodes: [...nodes.values()], edges: edgeList };
}

/**
 * The live Graph model. Deferred so bursts of Document changes (sync pages,
 * typing) coalesce instead of reheating the layout per keystroke. A React hook.
 */
export function useGraphModel(opts: GraphOptions = {}): GraphModel {
  const index = useDeferredValue(useLinkIndex());
  const types = useDocumentTypes();
  const { ghosts = true, tags = false, orphans = false, hiddenTypes, tagFilter } = opts;
  const hiddenKey = hiddenTypes ? [...hiddenTypes].sort().join(",") : "";
  const tagKey = tagFilter?.join(",") ?? "";
  return useMemo(
    () => buildGraph(index, types, { ghosts, tags, orphans, hiddenTypes, tagFilter }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [index, types, ghosts, tags, orphans, hiddenKey, tagKey],
  );
}
