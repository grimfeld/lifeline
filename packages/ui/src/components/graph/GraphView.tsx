import { useEffect, useRef } from "react";
import { cn } from "../../lib/utils";
import { createSimulation, type GraphSimulation, type SimNode } from "./simulation";

/**
 * The canvas Graph renderer (ADR 0023): one <canvas>, no DOM per node, serving
 * the Graph Surface, the Local graph panel and the Graph card alike. Layout
 * settles then freezes (zero CPU when idle); positions carry over by node id
 * across data changes and persist to localStorage under `storageKey`; dragged
 * nodes stay where dropped. Labels appear by zoom level; hover and `highlight`
 * spotlight a neighbourhood without relayout.
 */

export interface GraphViewNode {
  id: string;
  label: string;
  kind: "doc" | "ghost" | "tag";
  /** CSS color (may be var(--…)); doc nodes only. */
  color?: string;
  degree: number;
}

export interface GraphViewEdge {
  source: string;
  target: string;
  weight: number;
}

export interface GraphViewProps {
  nodes: GraphViewNode[];
  edges: GraphViewEdge[];
  onSelect?: (node: GraphViewNode) => void;
  /** Persist positions + viewport under this localStorage key. */
  storageKey?: string;
  /** Spotlight these node ids (search); everything else dims. */
  highlight?: ReadonlySet<string>;
  className?: string;
}

type Stored = { p?: Record<string, [number, number, (0 | 1)?]>; v?: [number, number, number] };

interface ViewState {
  k: number;
  tx: number;
  ty: number;
  interacted: boolean;
  fitted: boolean;
}

const radiusOf = (n: GraphViewNode): number =>
  n.kind === "ghost" ? 3 : Math.min(12, (n.kind === "tag" ? 4 : 3.5) + 1.7 * Math.log2(1 + n.degree));

function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

export function GraphView({ nodes, edges, onSelect, storageKey, highlight, className }: GraphViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef<GraphSimulation | null>(null);
  const metaRef = useRef<Map<string, GraphViewNode>>(new Map());
  const byIdRef = useRef<Map<string, SimNode>>(new Map());
  const adjRef = useRef<Map<string, Set<string>>>(new Map());
  const posRef = useRef<Map<string, { x: number; y: number; f: boolean }>>(new Map());
  const viewRef = useRef<ViewState>({ k: 1, tx: 0, ty: 0, interacted: false, fitted: false });
  const loadedRef = useRef(false);
  const structureRef = useRef("");
  const rafRef = useRef<number | null>(null);
  const hoverRef = useRef<string | null>(null);
  const highlightRef = useRef<ReadonlySet<string> | undefined>(highlight);
  const downRef = useRef<{ x: number; y: number; node: SimNode | null; moved: boolean } | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const persistNow = () => {
    if (!storageKey) return;
    const sim = simRef.current;
    if (!sim || sim.nodes.length === 0) return;
    const p: Stored["p"] = {};
    for (const n of sim.nodes) p[n.id] = [Math.round(n.x), Math.round(n.y), n.fx != null ? 1 : 0];
    const v = viewRef.current;
    try {
      localStorage.setItem(`lifeline.graph.${storageKey}`, JSON.stringify({ p, v: [v.k, v.tx, v.ty] } satisfies Stored));
    } catch {
      /* full or unavailable — layout is derived, losing it is fine */
    }
  };
  const persistSoon = () => {
    if (!storageKey) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(persistNow, 800);
  };

  const draw = () => {
    const canvas = canvasRef.current;
    const sim = simRef.current;
    if (!canvas || !sim) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const { k, tx, ty } = viewRef.current;

    const styles = getComputedStyle(canvas);
    const cache = new Map<string, string>();
    const resolve = (c: string): string => {
      let v = cache.get(c);
      if (v) return v;
      v = c.startsWith("var(") ? styles.getPropertyValue(c.slice(4, -1)).trim() || "#888" : c;
      cache.set(c, v);
      return v;
    };
    const fg = styles.getPropertyValue("--foreground").trim() || "#111";
    const mutedFg = styles.getPropertyValue("--muted-foreground").trim() || "#888";
    const fallback = resolve("var(--chart-green)");

    // Spotlight: search matches, else the hovered node's neighbourhood.
    const hl = highlightRef.current;
    let spot: ReadonlySet<string> | null = hl && hl.size > 0 ? hl : null;
    if (!spot && hoverRef.current) {
      const s = new Set<string>([hoverRef.current]);
      for (const n of adjRef.current.get(hoverRef.current) ?? []) s.add(n);
      spot = s;
    }

    // Edges.
    ctx.strokeStyle = mutedFg;
    for (const e of sim.edges) {
      const lit = !spot || (spot.has(e.source.id) && spot.has(e.target.id));
      ctx.globalAlpha = spot ? (lit ? 0.55 : 0.05) : 0.22;
      ctx.lineWidth = Math.max(0.4, Math.min(3, k * (0.7 + 0.25 * (e.weight - 1))));
      ctx.beginPath();
      ctx.moveTo(e.source.x * k + tx, e.source.y * k + ty);
      ctx.lineTo(e.target.x * k + tx, e.target.y * k + ty);
      ctx.stroke();
    }

    // Nodes.
    const labels: { x: number; y: number; text: string; strong: boolean }[] = [];
    for (const n of sim.nodes) {
      const meta = metaRef.current.get(n.id);
      if (!meta) continue;
      const sx = n.x * k + tx;
      const sy = n.y * k + ty;
      const r = Math.max(1.5, n.r * k);
      if (sx < -r || sy < -r || sx > w + r || sy > h + r) continue;
      const inSpot = !spot || spot.has(n.id);
      const base = meta.kind === "ghost" ? 0.55 : 1;
      ctx.globalAlpha = inSpot ? base : 0.12;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      if (meta.kind === "doc") {
        ctx.fillStyle = resolve(meta.color ?? "") || fallback;
        if (!meta.color) ctx.fillStyle = fallback;
        ctx.fill();
      } else {
        ctx.lineWidth = 1;
        ctx.strokeStyle = mutedFg;
        ctx.setLineDash(meta.kind === "ghost" ? [3, 2] : []);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (hoverRef.current === n.id) {
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = fg;
        ctx.beginPath();
        ctx.arc(sx, sy, r + 2.5, 0, Math.PI * 2);
        ctx.stroke();
      }
      const wanted = hoverRef.current === n.id || (spot ? spot.has(n.id) : k * n.r >= 4.5);
      if (wanted && inSpot && k >= 0.25) labels.push({ x: sx, y: sy + r + 11, text: meta.label, strong: hoverRef.current === n.id });
    }

    // Labels last, capped so a zoomed-in hairball stays drawable.
    ctx.globalAlpha = 1;
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    for (const l of labels.slice(0, 400)) {
      ctx.fillStyle = l.strong ? fg : mutedFg;
      ctx.fillText(l.text, l.x, l.y);
    }
    ctx.globalAlpha = 1;
  };

  const fit = () => {
    const canvas = canvasRef.current;
    const sim = simRef.current;
    if (!canvas || !sim || sim.nodes.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of sim.nodes) {
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x > maxX) maxX = n.x;
      if (n.y > maxY) maxY = n.y;
    }
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const spanX = Math.max(60, maxX - minX), spanY = Math.max(60, maxY - minY);
    const k = Math.min(2, 0.9 * Math.min(w / spanX, h / spanY));
    const v = viewRef.current;
    v.k = k;
    v.tx = w / 2 - (k * (minX + maxX)) / 2;
    v.ty = h / 2 - (k * (minY + maxY)) / 2;
  };

  const loop = () => {
    const sim = simRef.current;
    if (!sim) return;
    const settled = sim.tick(6);
    if (settled && !viewRef.current.fitted && sim.nodes.length > 0) {
      viewRef.current.fitted = true;
      if (!viewRef.current.interacted) fit();
    }
    draw();
    if (!settled) rafRef.current = requestAnimationFrame(loop);
    else {
      rafRef.current = null;
      persistSoon();
    }
  };
  const wake = () => {
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(loop);
  };

  // Build / rebuild the simulation when the graph structure changes.
  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      if (storageKey) {
        try {
          const raw = localStorage.getItem(`lifeline.graph.${storageKey}`);
          if (raw) {
            const stored = JSON.parse(raw) as Stored;
            for (const [id, [x, y, f]] of Object.entries(stored.p ?? {})) posRef.current.set(id, { x, y, f: f === 1 });
            if (stored.v) {
              const [k, tx, ty] = stored.v;
              Object.assign(viewRef.current, { k, tx, ty, interacted: true, fitted: true });
            }
          }
        } catch {
          /* ignore */
        }
      }
    }

    metaRef.current = new Map(nodes.map((n) => [n.id, n]));
    const adjacency = new Map<string, Set<string>>();
    const adj = (id: string) => {
      let s = adjacency.get(id);
      if (!s) adjacency.set(id, (s = new Set()));
      return s;
    };
    for (const e of edges) {
      adj(e.source).add(e.target);
      adj(e.target).add(e.source);
    }
    adjRef.current = adjacency;

    const structure =
      nodes.map((n) => n.id).sort().join("|") + "#" + edges.map((e) => `${e.source}>${e.target}`).sort().join("|");
    if (structure === structureRef.current && simRef.current) {
      // Same shape — refresh labels/colors/sizes only; a body edit that
      // changes no links must not move a node (ADR 0023).
      for (const sn of simRef.current.nodes) {
        const meta = metaRef.current.get(sn.id);
        if (meta) sn.r = radiusOf(meta);
      }
      draw();
      return;
    }
    structureRef.current = structure;

    // Carry positions over by id; place new nodes near a known neighbour.
    simRef.current?.stop();
    let known = 0;
    const simNodes: SimNode[] = nodes.map((n) => {
      const p = posRef.current.get(n.id);
      if (p) known++;
      const node: SimNode = { id: n.id, r: radiusOf(n), x: p?.x ?? 0, y: p?.y ?? 0 };
      if (p?.f) {
        node.fx = p.x;
        node.fy = p.y;
      }
      return node;
    });
    const posOf = new Map(simNodes.map((n) => [n.id, n]));
    for (const sn of simNodes) {
      if (posRef.current.has(sn.id)) continue;
      let cx = 0, cy = 0, c = 0;
      for (const nb of adjacency.get(sn.id) ?? []) {
        const p = posRef.current.get(nb) && posOf.get(nb);
        if (p) {
          cx += p.x;
          cy += p.y;
          c++;
        }
      }
      const jitter = hash(sn.id);
      if (c > 0) {
        sn.x = cx / c + ((jitter % 40) - 20);
        sn.y = cy / c + (((jitter >> 8) % 40) - 20);
      } else {
        const angle = ((jitter % 3600) / 3600) * Math.PI * 2;
        const rad = 150 + ((jitter >> 12) % 300);
        sn.x = Math.cos(angle) * rad;
        sn.y = Math.sin(angle) * rad;
      }
    }
    const gentle = nodes.length > 0 && known / nodes.length > 0.6;
    simRef.current = createSimulation(simNodes, edges, gentle ? 0.25 : 1);
    byIdRef.current = new Map(simNodes.map((n) => [n.id, n]));
    for (const sn of simNodes) posRef.current.set(sn.id, { x: sn.x, y: sn.y, f: sn.fx != null });
    if (!viewRef.current.interacted) viewRef.current.fitted = false;
    wake();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `wake` is a new function each render and reads only refs
  }, [nodes, edges, storageKey]);

  // Redraw on spotlight change; no relayout.
  useEffect(() => {
    highlightRef.current = highlight;
    draw();
  }, [highlight]);

  // Resize, wheel-zoom (native: needs passive: false), teardown.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(canvas);
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewRef.current;
      const factor = Math.exp(-e.deltaY * 0.002);
      const next = Math.min(8, Math.max(0.05, v.k * factor));
      const { offsetX, offsetY } = e;
      v.tx = offsetX - ((offsetX - v.tx) / v.k) * next;
      v.ty = offsetY - ((offsetY - v.ty) / v.k) * next;
      v.k = next;
      v.interacted = true;
      draw();
      persistSoon();
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      ro.disconnect();
      canvas.removeEventListener("wheel", onWheel);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      persistNow();
      simRef.current?.stop();
      simRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- set up once per mount; the teardown's last save uses the storageKey it mounted with
  }, []);

  const toWorld = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (e.clientX - rect.left - v.tx) / v.k, y: (e.clientY - rect.top - v.ty) / v.k };
  };
  const hitTest = (wx: number, wy: number): SimNode | null => {
    const sim = simRef.current;
    if (!sim) return null;
    const slack = 2 / Math.max(0.3, viewRef.current.k);
    let best: SimNode | null = null;
    let bestD = Infinity;
    for (const n of sim.nodes) {
      const dx = n.x - wx, dy = n.y - wy;
      const d = dx * dx + dy * dy;
      const rr = (n.r + slack) * (n.r + slack);
      if (d <= rr && d < bestD) {
        best = n;
        bestD = d;
      }
    }
    return best;
  };

  return (
    <canvas
      ref={canvasRef}
      className={cn("h-full w-full touch-none select-none", className)}
      role="img"
      aria-label="Graph of linked documents"
      onPointerDown={(e) => {
        const { x, y } = toWorld(e);
        downRef.current = { x: e.clientX, y: e.clientY, node: hitTest(x, y), moved: false };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const down = downRef.current;
        if (!down) {
          const { x, y } = toWorld(e);
          const hover = hitTest(x, y)?.id ?? null;
          if (hover !== hoverRef.current) {
            hoverRef.current = hover;
            e.currentTarget.style.cursor = hover ? "pointer" : "default";
            draw();
          }
          return;
        }
        if (Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) > 4) down.moved = true;
        if (down.node) {
          if (!down.moved) return;
          const { x, y } = toWorld(e);
          down.node.fx = x;
          down.node.fy = y;
          simRef.current?.dragTarget(0.15);
          wake();
        } else {
          const v = viewRef.current;
          v.tx += e.movementX;
          v.ty += e.movementY;
          v.interacted = true;
          draw();
        }
      }}
      onPointerUp={(e) => {
        const down = downRef.current;
        downRef.current = null;
        if (!down) return;
        if (down.node && down.moved) {
          // Sticky: the node stays where dropped (ADR 0023).
          simRef.current?.dragTarget(0);
          posRef.current.set(down.node.id, { x: down.node.fx ?? down.node.x, y: down.node.fy ?? down.node.y, f: true });
          wake();
          persistSoon();
        } else if (down.node && !down.moved) {
          const meta = metaRef.current.get(down.node.id);
          if (meta) onSelectRef.current?.(meta);
        } else {
          persistSoon();
        }
        e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onPointerLeave={() => {
        if (hoverRef.current) {
          hoverRef.current = null;
          draw();
        }
      }}
    />
  );
}
