/**
 * Card instance settings (ADR 0008). A CardDef may declare a small schema;
 * each placed instance on a Screen carries a `settings` blob validated
 * against it. Field kinds are deliberately few: a number, a fixed choice,
 * or a pick of one App entity (backed by a live options hook the App supplies).
 */

import { normalizeTags } from "./tags";

export interface CardOption {
  value: string;
  label: string;
}

export type CardFieldDef =
  | { kind: "number"; label: string; default: number; min?: number; max?: number; step?: number }
  | { kind: "select"; label: string; default: string; options: CardOption[] }
  | {
      kind: "entity";
      label: string;
      /** When true the card cannot be added until a value is chosen. */
      required?: boolean;
      /** React hook returning the current pickable entities. "" is "none". */
      useOptions: () => CardOption[];
      /** Label used for the empty choice when not required. */
      anyLabel?: string;
    }
  | {
      /** A Tag filter set (any-of). Auto-added as `tags` on tagFilterable Cards (ADR 0014). */
      kind: "tags";
      label: string;
    };

export type CardSettingsSchema = Record<string, CardFieldDef>;
export type CardSettingValue = string | number | string[];
export type CardSettings = Record<string, CardSettingValue>;

export function fieldDefault(f: CardFieldDef): CardSettingValue {
  if (f.kind === "entity") return "";
  if (f.kind === "tags") return [];
  return f.default;
}

/** Settings key of the auto-added Tag filter field on tagFilterable Cards. */
export const TAGS_SETTING = "tags";
export const TAGS_FIELD: CardFieldDef = { kind: "tags", label: "Only tags" };

/** The instance's own Tag filter set (empty when none / not filterable). */
export function settingsTags(settings: CardSettings | undefined): string[] {
  const v = settings?.[TAGS_SETTING];
  return Array.isArray(v) ? v : [];
}

/** Defaults for every field, with `given` values layered on top (unknown keys dropped). */
export function resolveSettings(schema: CardSettingsSchema | undefined, given?: CardSettings): CardSettings {
  const out: CardSettings = {};
  if (!schema) return out;
  for (const [k, f] of Object.entries(schema)) {
    const v = given?.[k];
    if (f.kind === "number") {
      out[k] = typeof v === "number" && Number.isFinite(v) ? clamp(v, f.min, f.max) : f.default;
    } else if (f.kind === "select") {
      out[k] = typeof v === "string" && f.options.some((o) => o.value === v) ? v : f.default;
    } else if (f.kind === "tags") {
      out[k] = normalizeTags(Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
    } else {
      out[k] = typeof v === "string" ? v : "";
    }
  }
  return out;
}

function clamp(v: number, min?: number, max?: number): number {
  if (min !== undefined && v < min) return min;
  if (max !== undefined && v > max) return max;
  return v;
}

/** True when the schema has at least one required field (configure-before-add). */
export function hasRequiredFields(schema?: CardSettingsSchema): boolean {
  return !!schema && Object.values(schema).some((f) => f.kind === "entity" && f.required);
}

/** True when every required field has a value. */
export function isConfigured(schema: CardSettingsSchema | undefined, settings: CardSettings): boolean {
  if (!schema) return true;
  return Object.entries(schema).every(
    ([k, f]) => !(f.kind === "entity" && f.required) || (typeof settings[k] === "string" && settings[k] !== ""),
  );
}
