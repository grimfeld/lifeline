import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import type L from "leaflet";
import { Maximize2 } from "lucide-react";
import { pinIcon } from "./MapViewImpl";
import { OSM_ATTRIBUTION, OSM_TILES } from "./tiles";
import { cn } from "../../lib/utils";

function Recenter({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon], map.getZoom() || 14, { animate: false });
  }, [map, lat, lon]);
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

/**
 * One entity's own little map: a single pin, optionally draggable (drop
 * writes the new coordinates back), with an "expand" affordance that opens
 * the full map Surface on this pin.
 */
export function MiniMap({
  lat,
  lon,
  color,
  onMove,
  onExpand,
  className,
  zoom = 14,
}: {
  lat: number;
  lon: number;
  color?: string;
  /** When given, the pin is draggable and this fires on drop. */
  onMove?: (lat: number, lon: number) => void;
  onExpand?: () => void;
  className?: string;
  zoom?: number;
}) {
  const icon = useMemo(() => pinIcon(color, 26), [color]);
  const markerRef = useRef<L.Marker>(null);
  const handlers = useMemo(
    () => ({
      dragend() {
        const m = markerRef.current;
        if (!m || !onMove) return;
        const { lat: la, lng } = m.getLatLng();
        onMove(Number(la.toFixed(6)), Number(lng.toFixed(6)));
      },
    }),
    [onMove],
  );
  return (
    <div className={cn("relative h-40 w-full overflow-hidden rounded-md border", className)}>
      <MapContainer center={[lat, lon]} zoom={zoom} zoomControl={false} scrollWheelZoom={false} className="h-full w-full" attributionControl>
        <TileLayer url={OSM_TILES} attribution={OSM_ATTRIBUTION} maxZoom={19} />
        <Recenter lat={lat} lon={lon} />
        <Marker ref={markerRef} position={[lat, lon]} icon={icon} draggable={!!onMove} eventHandlers={handlers} />
      </MapContainer>
      {onExpand && (
        <button
          type="button"
          onClick={onExpand}
          aria-label="Open on the map"
          title="Open on the map"
          className="bg-popover text-popover-foreground hover:bg-accent absolute top-1.5 right-1.5 z-[400] rounded-md border p-1 shadow-sm"
        >
          <Maximize2 className="size-3.5" />
        </button>
      )}
      {onMove && <div className="text-muted-foreground bg-popover/80 absolute bottom-1 left-1 z-[400] rounded px-1 text-[10px]">drag the pin to adjust</div>}
    </div>
  );
}
