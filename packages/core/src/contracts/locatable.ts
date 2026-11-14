import { useMemo } from "react";
import { appById } from "../registry";
import { matchesTagFilter, type TagFilter } from "../tags";
import { useTagFilter } from "./tagfilter";
import { useAllDocuments } from "../documents/store";
import { useDocumentTypes } from "../documents/registry";
import { displayTitle, geoOf, singularOf, type Document, type DocumentTypeDef } from "../documents/types";
import { docHref } from "../documents/href";

/**
 * The Locatable Contract (ADR 0011, now data-declarable per ADR 0019): a
 * Document type names the geo field (or a reader) that places its Documents
 * on a map. Pins carry resolved coordinates only — geocoding happens at
 * edit time, never at render time.
 */
export interface Pin {
  /** Owning App id, or "vault" for user-defined types. */
  appId: string;
  /** Document id. */
  itemId: string;
  /** Document type id. */
  type: string;
  name: string;
  subtitle?: string;
  lat: number;
  lon: number;
  href?: string;
  tags?: string[];
}

export interface SurfacePin extends Pin {
  /** `${type}/${itemId}` — unique. */
  key: string;
  color?: string;
}

export const VAULT_APP_ID = "vault";

/** Whether a type puts its Documents on the map, by one place or several. */
export const isLocatableDef = (def: Pick<DocumentTypeDef, "locatable" | "locatablePins" | "internal"> | undefined): boolean =>
  !!def && !def.internal && !!(def.locatable || def.locatablePins);

/**
 * The Pins of some Documents, pure: one per Locatable Document, or one per
 * place for a type that reads several (`locatablePins`). A several-place Pin's
 * key is `${type}/${id}#${placeId}`, so each is its own on the map.
 */
export function pinsOf(
  docs: readonly Document[],
  types: readonly DocumentTypeDef[],
  apps: string[] | undefined,
  filter: TagFilter,
): SurfacePin[] {
  const defs = new Map(types.map((t) => [t.id, t]));
  return docs.flatMap((d) => {
    const def = defs.get(d.type);
    if (!def || !isLocatableDef(def)) return [];
    const appId = def.appId ?? VAULT_APP_ID;
    if (!inApps(apps, appId, d.type) || !matchesTagFilter(d.tags, filter)) return [];
    return pinsOfDocument(d, def, appId);
  });
}

/** Whether Pins of this App and type are wanted: every one when no App or type is named. */
const inApps = (apps: string[] | undefined, appId: string, type: string): boolean => !apps?.length || apps.includes(appId) || apps.includes(type);

/** One Locatable Document's Pins: one, at its place, or one per valid place for a type that reads several. */
function pinsOfDocument(d: Document, def: DocumentTypeDef, appId: string): SurfacePin[] {
  const base = {
    appId,
    itemId: d.id,
    type: d.type,
    subtitle: singularOf(def),
    href: docHref(d, def),
    tags: d.tags,
    color: def.appId ? appById(def.appId)?.color : undefined,
  };
  if (def.locatablePins) {
    return def.locatablePins(d)
      .filter((p) => isValidCoord(p.lat, p.lon))
      .map((p) => ({ ...base, key: `${d.type}/${d.id}#${p.id}`, name: p.name, lat: p.lat, lon: p.lon }));
  }
  const c = geoOf(d, def);
  return c ? [{ ...base, key: `${d.type}/${d.id}`, name: displayTitle(d, def), lat: c.lat, lon: c.lon }] : [];
}

/** Read side: every Locatable Document under the ambient tag filter as a pin, coloured per owning App; optionally only some Apps / types. */
export function useLocatablePins(apps?: string[]): SurfacePin[] {
  const filter = useTagFilter();
  const docs = useAllDocuments();
  const types = useDocumentTypes();
  return useMemo(() => pinsOf(docs, types, apps, filter), [docs, types, apps, filter]);
}

/** Document types that declare Locatable, for pickers. */
export function useLocatableTypes(): { value: string; label: string }[] {
  const types = useDocumentTypes();
  return types.filter(isLocatableDef).map((t) => ({ value: t.id, label: t.label }));
}

/** True when the pair is a plausible WGS84 coordinate. */
export function isValidCoord(lat: unknown, lon: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180
  );
}
