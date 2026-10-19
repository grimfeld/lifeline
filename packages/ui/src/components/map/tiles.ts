/** What a map needs to draw one point. Surfaces map their contract items onto this. */
export interface MapPin {
  key: string;
  name: string;
  subtitle?: string;
  lat: number;
  lon: number;
  /** CSS colour (App accent). */
  color?: string;
  href?: string;
}

/** OSM raster tiles with the attribution their policy requires (ADR 0011). */
export const OSM_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';
