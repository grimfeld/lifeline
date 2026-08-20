import { useMemo } from "react";
import { appById } from "../registry";
import { matchesTagFilter, type TagFilter } from "../tags";
import { useTagFilter } from "./tagfilter";
import { useAllDocuments } from "../documents/store";
import { useDocumentTypes } from "../documents/registry";
import { displayTitle, geoOf, singularOf } from "../documents/types";
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

/** Read side: every Locatable Document as a pin, coloured per owning App; optionally only some Apps / types. */
export function useLocatablePins(apps?: string[], opts?: { tags?: TagFilter }): SurfacePin[] {
  const ambient = useTagFilter();
  const filter = opts?.tags ?? ambient;
  const docs = useAllDocuments();
  const types = useDocumentTypes();
  return useMemo(() => {
    const defs = new Map(types.map((t) => [t.id, t]));
    const out: SurfacePin[] = [];
    for (const d of docs) {
      const def = defs.get(d.type);
      if (!def?.locatable || def.internal) continue;
      const appId = def.appId ?? VAULT_APP_ID;
      if (apps && apps.length > 0 && !apps.includes(appId) && !apps.includes(d.type)) continue;
      const c = geoOf(d, def);
      if (!c) continue;
      if (!matchesTagFilter(d.tags, filter)) continue;
      out.push({
        key: `${d.type}/${d.id}`,
        appId,
        itemId: d.id,
        type: d.type,
        name: displayTitle(d, def),
        subtitle: singularOf(def),
        lat: c.lat,
        lon: c.lon,
        href: docHref(d, def),
        tags: d.tags,
        color: def.appId ? appById(def.appId)?.color : undefined,
      });
    }
    return out;
  }, [docs, types, apps, filter]);
}

/** Document types that declare Locatable, for pickers. */
export function useLocatableTypes(): { value: string; label: string }[] {
  const types = useDocumentTypes();
  return types.filter((t) => t.locatable && !t.internal).map((t) => ({ value: t.id, label: t.label }));
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
