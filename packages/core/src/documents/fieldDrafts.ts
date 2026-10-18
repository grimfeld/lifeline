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

/** Whether a kind has settings of its own — a Choice's options, a Link's target — shown in the row's fold-out. */
export const hasFieldSettings = (k: FieldKind): boolean => isChoiceKind(k) || isLinkKind(k);

/** Whether a row has a fold-out (⚙): its kind's settings, or — until the type is saved with it — the key, whatever the kind. */
export const hasFoldOut = (d: Pick<FieldDraft, "kind" | "saved">): boolean => !d.saved || hasFieldSettings(d.kind);

/** How a folded row names types and Roles. */
export interface SummaryNames {
  typeLabel: (id: string) => string;
  roleLabel: (id: string) => string;
}

/** A folded row's one-line summary of its settings: "3 options", "→ Person"; empty for kinds without settings. */
export function fieldSummary(d: Pick<FieldDraft, "kind" | "options" | "target">, names: SummaryNames): string {
  if (isChoiceKind(d.kind)) {
    const n = d.options.length;
    return n === 0 ? "No options" : `${n} option${n === 1 ? "" : "s"}`;
  }
  if (!isLinkKind(d.kind)) return "";
  const t = d.target;
  if (t.to === "role") return `→ ${names.roleLabel(t.role)} (Role)`;
  if (t.to === "types" && t.types.length) return `→ ${t.types.map(names.typeLabel).join(", ")}`;
  return "→ Any type";
}

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

/** A new label; a new Field's key follows it until typed by hand. A saved Field's key never moves. */
export function relabelField(d: FieldDraft, label: string): FieldDraft {
  const follows = !d.saved && d.key === fieldKeyFrom(d.label);
  return { ...d, label, ...(follows ? { key: fieldKeyFrom(label) } : {}) };
}

/** A key typed by hand — only until the type is saved with the Field. */
export const rekeyField = (d: FieldDraft, key: string): FieldDraft => (d.saved ? d : { ...d, key });

const sameList =(a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

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
    f.options = isChoiceKind(d.kind) ? d.options.filter((o) => o.saved || (o.label.trim() && o.value)).map((o): FieldOption => ({ value: o.value, label: o.label.trim() || o.value })) : wasOptions;
  if (isLinkKind(d.kind) || sameKind) Object.assign(f, linkProps(d));
  return f;
}

/** Drafts back as a type's Fields; drafts with no key yet are left out. */
export function fieldsFromDrafts(drafts: FieldDraft[]): FieldDef[] {
  return drafts.map(fieldFromDraft).filter((f): f is FieldDef => !!f);
}

const otherValues = (options: OptionDraft[], skip: number) => options.filter((_, j) => j !== skip).map((o) => o.value);

/** A Choice's options with one more at `at` (default: the end); its value comes from its label. */
export function addOption(d: FieldDraft, label = "", at = d.options.length): FieldDraft {
  const options = [...d.options];
  options.splice(at, 0, { value: optionValueFrom(label, options.map((o) => o.value)), label, saved: false });
  return { ...d, options };
}

/** A new label for option `i`; an unsaved option's value follows it, a saved one's is fixed. */
export function renameOption(d: FieldDraft, i: number, label: string): FieldDraft {
  return { ...d, options: d.options.map((o, j) => (j !== i ? o : o.saved ? { ...o, label } : { ...o, label, value: optionValueFrom(label, otherValues(d.options, i)) })) };
}

/** A Choice's options without option `i`. */
export const removeOption = (d: FieldDraft, i: number): FieldDraft => ({ ...d, options: d.options.filter((_, j) => j !== i) });
