import { lazy, Suspense, type ComponentProps } from "react";
import { cn } from "../../lib/utils";

export { OSM_ATTRIBUTION, OSM_TILES, type MapPin } from "./tiles";

/*
 * The maps load Leaflet on first use: it is a large share of the bundle and
 * most screens never draw a map. The components keep their names and props;
 * until Leaflet arrives they hold their place with an empty panel.
 */
const MapViewImpl = lazy(() => import("./MapViewImpl").then((m) => ({ default: m.MapView })));
const MiniMapImpl = lazy(() => import("./MiniMapImpl").then((m) => ({ default: m.MiniMap })));

export type MapViewProps = ComponentProps<typeof import("./MapViewImpl").MapView>;
export type MiniMapProps = ComponentProps<typeof import("./MiniMapImpl").MiniMap>;

/**
 * The map Surface's canvas: OSM tiles, one coloured pin per item, a popup
 * with name/subtitle/Open. Fits to the pins on mount and whenever they
 * change; `focus` centres on one pin instead.
 */
export function MapView(props: MapViewProps) {
  return (
    <Suspense fallback={<div className={cn("bg-muted/40 relative h-full min-h-0 w-full overflow-hidden rounded-md", props.className)} />}>
      <MapViewImpl {...props} />
    </Suspense>
  );
}

/**
 * One entity's own little map: a single pin, optionally draggable (drop
 * writes the new coordinates back), with an "expand" affordance that opens
 * the full map Surface on this pin.
 */
export function MiniMap(props: MiniMapProps) {
  return (
    <Suspense fallback={<div className={cn("bg-muted/40 relative h-40 w-full overflow-hidden rounded-md border", props.className)} />}>
      <MiniMapImpl {...props} />
    </Suspense>
  );
}
