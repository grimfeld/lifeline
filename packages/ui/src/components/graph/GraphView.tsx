import { Suspense } from "react";
import { cn } from "../../lib/utils";
import { lazyChunk } from "../../lib/lazyChunk";
import type { GraphViewProps } from "./GraphViewImpl";

export type { GraphViewEdge, GraphViewNode, GraphViewProps } from "./GraphViewImpl";

/*
 * The Graph loads its renderer and d3-force on first use, as the maps load
 * Leaflet (MapView.tsx): the Graph card would carry them into every first
 * load. Until they arrive the canvas's place stays empty.
 */
const GraphViewImpl = lazyChunk(() => import("./GraphViewImpl").then((m) => ({ default: m.GraphView })));

/** The canvas Graph renderer (ADR 0023), see GraphViewImpl.tsx. */
export function GraphView(props: GraphViewProps) {
  return (
    <Suspense fallback={<div className={cn("h-full w-full", props.className)} />}>
      <GraphViewImpl {...props} />
    </Suspense>
  );
}
