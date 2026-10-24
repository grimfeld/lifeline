import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./map.css";
import { cn } from "../../lib/utils";
import { OSM_ATTRIBUTION, OSM_TILES, type MapPin } from "./tiles";

/* Leaflet's side of the maps, loaded on first use (see ./MapView). */

const WORLD: [number, number] = [30, 0];

/** A coloured pin drawn from CSS, so no marker image assets are needed. */
export function pinIcon(color = "var(--primary)", size = 22): L.DivIcon {
  return L.divIcon({
    className: "ll-pin",
    html: `<span class="ll-pin-dot" style="--pin:${color};--pin-size:${size}px"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

function FitToPins({ pins, focus }: { pins: MapPin[]; focus?: string }) {
  const map = useMap();
  const signature = pins.map((p) => `${p.key}:${p.lat},${p.lon}`).join("|");
  useEffect(() => {
    const target = focus ? pins.find((p) => p.key === focus) : undefined;
    if (target) {
      map.setView([target.lat, target.lon], Math.max(map.getZoom(), 15));
      return;
    }
    if (pins.length === 0) {
      map.setView(WORLD, 2);
      return;
    }
    if (pins.length === 1) {
      map.setView([pins[0]!.lat, pins[0]!.lon], 13);
      return;
    }
    map.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lon] as [number, number])), { padding: [32, 32], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refit only when the set of pins (or the focus) changes, not on every render
  }, [map, signature, focus]);
  return null;
}

/** Leaflet resizes lazily; nudge it when the container's box changes (cards resize, panels toggle). */
function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

/**
 * The map Surface's canvas: OSM tiles, one coloured pin per item, a popup
 * with name/subtitle/Open. Fits to the pins on mount and whenever they
 * change; `focus` centres on one pin instead.
 */
export function MapView({
  pins,
  focus,
  onOpen,
  className,
  zoomControl = true,
}: {
  pins: MapPin[];
  /** Key of a pin to centre on (e.g. from a `?focus=` param). */
  focus?: string;
  onOpen?: (pin: MapPin) => void;
  className?: string;
  zoomControl?: boolean;
}) {
  const icons = useMemo(() => {
    const m = new Map<string, L.DivIcon>();
    for (const p of pins) {
      const c = p.color ?? "var(--primary)";
      if (!m.has(c)) m.set(c, pinIcon(c));
    }
    return m;
  }, [pins]);

  return (
    <div className={cn("relative h-full min-h-0 w-full overflow-hidden rounded-md", className)}>
      <MapContainer center={WORLD} zoom={2} zoomControl={zoomControl} className="h-full w-full" attributionControl>
        <TileLayer url={OSM_TILES} attribution={OSM_ATTRIBUTION} maxZoom={19} />
        <InvalidateOnResize />
        <FitToPins pins={pins} focus={focus} />
        {pins.map((p) => (
          <Marker key={p.key} position={[p.lat, p.lon]} icon={icons.get(p.color ?? "var(--primary)")}>
            <Popup>
              <div className="ll-popup">
                <div className="ll-popup-name">{p.name}</div>
                {p.subtitle && <div className="ll-popup-sub">{p.subtitle}</div>}
                {onOpen && p.href && (
                  <button type="button" className="ll-popup-open" onClick={() => onOpen(p)}>
                    Open →
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
