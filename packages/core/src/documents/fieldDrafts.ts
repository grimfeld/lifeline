import { isLinkKind, slugify, type FieldDef, type FieldKind, type FieldOption } from "./types";

/**
 * The Type editor's Field model (CONTEXT.md "Field", spec #95): a type's
 * Fields as editable drafts and back. Pure. A draft carries every FieldDef
 * property the editor doesn't edit through untouched, so saving a type can
 * never drop what the editor can't show.
 */

/** What a Link Field offers: any linkable type, one or several types, or the Documents playing a Role (ADR 0069). */
export type LinkTarget = { to: "any" } | { to: "types"; types: string[] } | { to: "role"; role: string };

/** A Choice option (CONTEXT.md "Choice (field)"): the label is edited; the value is set when added and fixed once saved. */
export interface OptionDraft {
  value: string;
  label: string;
  saved: boolean;
}

/** One Field being edited. `saved` Fields keep their key — a Field is fixed once it exists. */
export interface FieldDraft {
  key: string;
  label: string;
  kind: FieldKind;
  /** Choice / Multi-choice options, in picker order. */
  options: OptionDraft[];
  /** Link / Links target. */
  target: LinkTarget;
  saved: boolean;
  /** The Field as loaded (undefined for a new one): everything the draft doesn't edit comes back from it. */
  from?: FieldDef;
}

const isChoiceKind = (k: FieldKind): boolean => k === "select" || k === "multiselect";

/** A frontmatter key from a label or a typed key: `Met at` → `met_at`. */
export const fieldKeyFrom = (label: string): string => slugify(label).replace(/-/g, "_");

/** An option's stored value from its label, unique among `taken`: `Eating out` → `eating_out`. */
export function optionValueFrom(label: string, taken: Iterable<string> = []): string {
  const base = fieldKeyFrom(label) || label.trim();
  const used = new Set(taken);
  let v = base;
  for (let n = 2; used.has(v); n++) v = `${base}_${n}`;
  return v;
}

/** A Link's target as read from its FieldDef — the Role wins over `linkType` (ADR 0069). */
export function linkTargetOf(f: Pick<FieldDef, "linkType" | "linkRole">): LinkTarget {
  if (f.linkRole) return { to: "role", role: f.linkRole };
  const types = f.linkType === undefined ? [] : Array.isArray(f.linkType) ? f.linkType : [f.linkType];
  return types.length ? { to: "types", types: [...types] } : { to: "any" };
}

/** A type's Fields as editable drafts. */
export function toFieldDrafts(fields: FieldDef[]): FieldDraft[] {
  return fields.map((f) => ({
    key: f.key,
    label: f.label,
    kind: f.kind,
    options: (f.options ?? []).map((o) => ({ value: o.value, label: o.label, saved: true })),
    target: linkTargetOf(f),
    saved: true,
    from: f,
  }));
}

/** A blank draft for a Field being added. */
export const newFieldDraft = (kind: FieldKind = "text", label = ""): FieldDraft => ({ key: fieldKeyFrom(label), label, kind, options: [], target: { to: "any" }, saved: false });

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

function linkProps(d: FieldDraft): Pick<FieldDef, "linkType" | "linkRole"> {
  const was = d.from;
  const t = d.target;
  if (t.to === "role") return { linkRole: t.role, ...(was?.linkRole && was.linkType !== undefined ? { linkType: was.linkType } : {}) };
  if (t.to === "any" || !t.types.length) return {};
  // The stored shape (a one-type list stays a list) is kept while the types are unchanged.
  const wasTypes = was ? linkTargetOf({ linkType: was.linkType }) : undefined;
  if (was?.linkType !== undefined && wasTypes?.to === "types" && sameList(wasTypes.types, t.types)) return { linkType: was.linkType };
  return { linkType: t.types.length === 1 ? t.types[0] : [...t.types] };
}

/** One draft back as a FieldDef, or undefined when it has no key yet. */
export function fieldFromDraft(d: FieldDraft): FieldDef | undefined {
  if (!d.key.trim()) return undefined;
  const key = d.saved ? d.key : fieldKeyFrom(d.key) || d.key.trim();
  const label = d.label.trim() || d.key.trim();
  const { key: _k, label: _l, kind: _kind, options: wasOptions, linkType: _t, linkRole: _r, ...rest } = d.from ?? ({} as Partial<FieldDef>);
  const f: FieldDef = { ...rest, key, label, kind: d.kind };
  const sameKind = d.from?.kind === d.kind;
  if (isChoiceKind(d.kind) ? d.options.length > 0 || wasOptions !== undefined : sameKind && wasOptions !== undefined)
    f.options = isChoiceKind(d.kind) ? d.options.map((o): FieldOption => ({ value: o.value, label: o.label })) : wasOptions;
  if (isLinkKind(d.kind) || sameKind) Object.assign(f, linkProps(d));
  return f;
}

/** Drafts back as a type's Fields; drafts with no key yet are left out. */
export function fieldsFromDrafts(drafts: FieldDraft[]): FieldDef[] {
  return drafts.map(fieldFromDraft).filter((f): f is FieldDef => !!f);
}

/** Options as the editor's comma box shows them: `home=Home, out` (value=Label, or the value alone when they match). */
export const optionsText = (options: FieldOption[]): string => options.map((o) => (o.value === o.label ? o.value : `${o.value}=${o.label}`)).join(", ");

/** The comma box read back as options; values the Field already had (`prior`) stay marked saved. */
export function optionsFromText(text: string, prior: OptionDraft[] = []): OptionDraft[] {
  const saved = new Set(prior.filter((o) => o.saved).map((o) => o.value));
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [v, l] = s.split("=");
      const value = v.trim();
      return { value, label: (l ?? v).trim(), saved: saved.has(value) };
    });
}
