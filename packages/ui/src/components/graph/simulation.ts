import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";

/**
 * The layout engine behind GraphView (ADR 0023). Deliberately worker-shaped:
 * plain data in, positions out, ticked by the caller — no React, no DOM — so
 * moving it into a Web Worker later is mechanical.
 */

export interface SimNode extends SimulationNodeDatum {
  id: string;
  /** Render radius, used for collision. */
  r: number;
  x: number;
  y: number;
}

export interface SimEdge {
  source: string;
  target: string;
  weight: number;
}

/** A SimEdge after d3 resolves endpoints to node objects. */
export type LiveEdge = SimulationLinkDatum<SimNode> & { source: SimNode; target: SimNode; weight: number };

export interface GraphSimulation {
  nodes: SimNode[];
  /** Edges with endpoints resolved to live nodes (same objects as `nodes`). */
  edges: LiveEdge[];
  /** Advance until settled or the frame budget (ms) is spent. Returns settled. */
  tick(budgetMs?: number): boolean;
  settled(): boolean;
  /** Reheat to the given alpha (gentle ~0.15, full 1). */
  reheat(alpha: number): void;
  /** Keep simmering while a node is dragged; 0 lets it settle again. */
  dragTarget(target: number): void;
  stop(): void;
}

const ALPHA_MIN = 0.02;

export function createSimulation(nodes: SimNode[], edges: SimEdge[], alpha: number): GraphSimulation {
  const links = edges.map((e) => ({ ...e }));
  const sim: Simulation<SimNode, undefined> = forceSimulation(nodes)
    .force("charge", forceManyBody<SimNode>().strength(-50).distanceMax(400).theta(0.9))
    .force(
      "link",
      forceLink<SimNode, SimulationLinkDatum<SimNode>>(links)
        .id((n) => n.id)
        .distance(60),
    )
    .force("x", forceX(0).strength(0.05))
    .force("y", forceY(0).strength(0.05))
    .force("collide", forceCollide<SimNode>().radius((n) => n.r + 3).strength(0.7))
    .alpha(alpha)
    .alphaMin(ALPHA_MIN)
    .alphaDecay(0.028)
    .stop();

  let target = 0;

  return {
    nodes,
    edges: links as LiveEdge[],
    tick(budgetMs = 6) {
      const start = performance.now();
      while (sim.alpha() > ALPHA_MIN || target > 0) {
        sim.tick();
        if (performance.now() - start >= budgetMs) break;
        if (target > 0) break; // one tick per frame while dragging
      }
      return this.settled();
    },
    settled: () => sim.alpha() <= ALPHA_MIN && target === 0,
    reheat(a) {
      if (sim.alpha() < a) sim.alpha(a);
    },
    dragTarget(t) {
      target = t;
      sim.alphaTarget(t);
      if (t > 0 && sim.alpha() < t) sim.alpha(t);
    },
    stop: () => sim.stop(),
  };
}
