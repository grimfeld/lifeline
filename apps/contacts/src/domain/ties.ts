import type { Person, Tie, TieKind } from "./types";

/** The preset words of one end of a kind: female, male, neutral. */
type Words = readonly [female: string, male: string, neutral: string];
const HAS = (a: Words, b: Words) => ({ a, b });
const PARENT: Words = ["mother", "father", "parent"];
const CHILD: Words = ["daughter", "son", "child"];
const SIBLING: Words = ["sister", "brother", "sibling"];
const PARTNER: Words = ["wife", "husband", "partner"];
const GRANDPARENT: Words = ["grandmother", "grandfather", "grandparent"];
const GRANDCHILD: Words = ["granddaughter", "grandson", "grandchild"];
const AUNT_UNCLE: Words = ["aunt", "uncle", "aunt or uncle"];
const NIECE_NEPHEW: Words = ["niece", "nephew", "niece or nephew"];
const COUSIN: Words = ["cousin", "cousin", "cousin"];

/** The words of each end of each kind (ADR 0130): `a` names end a, `b` end b. */
export const KIND_WORDS: Record<TieKind, { a: Words; b: Words }> = {
  parent: HAS(PARENT, CHILD),
  child: HAS(CHILD, PARENT),
  sibling: HAS(SIBLING, SIBLING),
  partner: HAS(PARTNER, PARTNER),
  grandparent: HAS(GRANDPARENT, GRANDCHILD),
  grandchild: HAS(GRANDCHILD, GRANDPARENT),
  auntUncle: HAS(AUNT_UNCLE, NIECE_NEPHEW),
  nieceNephew: HAS(NIECE_NEPHEW, AUNT_UNCLE),
  cousin: HAS(COUSIN, COUSIN),
};

const INVERSE: Record<TieKind, TieKind> = { parent: "child", child: "parent", sibling: "sibling", partner: "partner", grandparent: "grandchild", grandchild: "grandparent", auntUncle: "nieceNephew", nieceNephew: "auntUncle", cousin: "cousin" };
/** The same Tie's kind read from the other end. */
export const invertKind = (kind: TieKind): TieKind => INVERSE[kind];

/** One preset chip: the word for the other Person, and the kind it gives with this Person as end `a`. */
export interface Preset {
  word: string;
  kind: TieKind;
}

/** The chips, in order. A word names end `b` of its kind ("daughter": this Person is her parent). */
export const PRESETS: readonly Preset[] = [
  ["daughter", "parent"], ["son", "parent"], ["child", "parent"],
  ["sister", "sibling"], ["brother", "sibling"], ["sibling", "sibling"],
  ["mother", "child"], ["father", "child"], ["parent", "child"],
  ["wife", "partner"], ["husband", "partner"], ["partner", "partner"],
  ["granddaughter", "grandparent"], ["grandson", "grandparent"], ["grandchild", "grandparent"],
  ["grandmother", "grandchild"], ["grandfather", "grandchild"], ["grandparent", "grandchild"],
  ["niece", "auntUncle"], ["nephew", "auntUncle"],
  ["aunt", "nieceNephew"], ["uncle", "nieceNephew"],
  ["cousin", "cousin"],
].map(([word, kind]) => ({ word: word!, kind: kind as TieKind }));

const norm = (w: string) => w.trim().toLowerCase();
const KINDS = Object.keys(KIND_WORDS) as TieKind[];

/**
 * The kind two words read as, `labelA` for end a and `labelB` for end b:
 * a consistent preset pair, any case, trimmed; else none. Read, never stored.
 */
export function kindOfWords(labelA: string, labelB: string): TieKind | undefined {
  const [a, b] = [norm(labelA), norm(labelB)];
  return KINDS.find((k) => KIND_WORDS[k].a.includes(a) && KIND_WORDS[k].b.includes(b));
}

/** One Tie as a Person's page shows it: the other Person, and the labels from this Person's side. */
export interface TieRow {
  id: string;
  otherId: string;
  otherName: string;
  /** What the other Person is to this one ("daughter" on Anne's page). */
  label: string;
  /** What this Person is to the other ("mother"). */
  ownLabel: string;
  /** What the Tie means read from this Person to the other (ADR 0130): stored, else read from the two words; none for free words. */
  kind?: TieKind;
  /** The kind was read from the two words, not stored: kept on save only while the two words still form that preset pair. */
  kindRead?: true;
}

/**
 * A Person's Ties, read from their own side (#412): stored once, so the same
 * Tie gives each end the other's word. A Tie whose other Person isn't in
 * `people` (deleted, or in another Workspace) is left out. In name order.
 */
export function tiesSeenFrom(personId: string, ties: readonly Tie[], people: readonly Pick<Person, "id" | "title">[]): TieRow[] {
  const names = new Map(people.map((p) => [p.id, p.title]));
  const rows: TieRow[] = [];
  for (const t of ties) {
    const mine = t.a === personId;
    if (!mine && t.b !== personId) continue;
    const otherId = mine ? t.b : t.a;
    const otherName = names.get(otherId);
    if (otherName === undefined) continue;
    const kind = tieKindOf(t);
    const read = kind !== undefined && kind !== t.kind;
    rows.push({ id: t.id, otherId, otherName, label: mine ? t.labelB : t.labelA, ownLabel: mine ? t.labelA : t.labelB, ...(kind ? { kind: mine ? kind : invertKind(kind) } : {}), ...(read ? { kindRead: true as const } : {}) });
  }
  return rows.sort((x, y) => x.otherName.localeCompare(y.otherName));
}

/** A Person the Tie dialog can offer as the other end: anyone but this Person, found by name or alias. */
export interface TieCandidate {
  value: string;
  label: string;
  keywords: string[];
  /** Their Relationship, when they have one. */
  description?: string;
}

/** Who a Tie from `personId`'s page can go to: everyone else. */
export function tieCandidates(personId: string, people: readonly Pick<Person, "id" | "title" | "aliases" | "relationship">[]): TieCandidate[] {
  return people.filter((p) => p.id !== personId).map((p) => ({ value: p.id, label: p.title, keywords: p.aliases, ...(p.relationship ? { description: p.relationship } : {}) }));
}

/**
 * The Tie dialog's two questions, asked from `personName`'s page. A Tie is
 * between two People, never to me, so both name the People; the other one
 * once they are picked.
 */
export function tieQuestions(personName: string, otherName: string): { label: string; ownLabel: string } {
  if (!otherName) return { label: `They are ${personName}'s…`, ownLabel: `${personName} is their…` };
  return { label: `${otherName} is ${personName}'s…`, ownLabel: `${personName} is ${otherName}'s…` };
}

/** What the Tie dialog holds: the other Person's id ("" until picked) and the two words, as this page reads them. */
export interface TieDraft {
  otherId: string;
  label: string;
  ownLabel: string;
  /** The kind, read from this Person to the other; absent for free words. */
  kind?: TieKind;
  /** The kind was only read from the words (see `TieRow.kindRead`); a chip tap makes it a chosen one. */
  kindRead?: true;
}

/** The Tie dialog as it opens: blank for a new Tie, else the row's other Person, words and kind. */
export const tieDraft = (row: TieRow | undefined): TieDraft =>
  row ? { otherId: row.otherId, label: row.label, ownLabel: row.ownLabel, ...(row.kind ? { kind: row.kind } : {}), ...(row.kindRead ? { kindRead: true as const } : {}) } : { otherId: "", label: "", ownLabel: "" };

/** The other Person's name in the dialog: the one picked, else the row's (when they are not among `people`), else none yet. */
export function otherNameOf(people: readonly Pick<Person, "id" | "title">[], otherId: string, row: Pick<TieRow, "otherName"> | undefined): string {
  return people.find((p) => p.id === otherId)?.title ?? row?.otherName ?? "";
}

/** A Tie's kind: the one it carries, else the one its words read as. */
export const tieKindOf = (t: Pick<Tie, "labelA" | "labelB" | "kind">): TieKind | undefined =>
  // A stored value that is no kind (a text Field can hold anything) counts as none.
  t.kind && Object.hasOwn(KIND_WORDS, t.kind) ? t.kind : kindOfWords(t.labelA, t.labelB);

export type Gender = "female" | "male" | "neutral";

/**
 * A Person's gender as their own kinded Ties say it (ADR 0130): female or male
 * when every gendered preset word that names them is of one gender, else
 * neutral. Neutral words ("parent", "cousin") say nothing. Nothing is asked.
 */
export function genderOf(personId: string, ties: readonly Tie[]): Gender {
  const seen = new Set<Gender>();
  for (const t of ties) {
    const kind = tieKindOf(t);
    if (!kind || (t.a !== personId && t.b !== personId)) continue;
    const mine = t.a === personId;
    const word = norm(mine ? t.labelA : t.labelB);
    // The words of the end that names them: a's words when they are `a`.
    const words = mine ? KIND_WORDS[kind].a : KIND_WORDS[kind].b;
    if (words[0] === words[1]) continue;
    if (word === words[0]) seen.add("female");
    else if (word === words[1]) seen.add("male");
  }
  const [only, ...rest] = seen;
  return only && rest.length === 0 ? only : "neutral";
}

const GENDER_INDEX: Record<Gender, 0 | 1 | 2> = { female: 0, male: 1, neutral: 2 };

/**
 * What a tapped chip fills, from this Person's page: the other's word, this
 * Person's inverse word (gendered by `own`), and the kind read from this Person.
 */
export function presetWords(preset: Preset, own: Gender): { label: string; ownLabel: string; kind: TieKind } {
  return { label: preset.word, ownLabel: KIND_WORDS[preset.kind].a[GENDER_INDEX[own]], kind: preset.kind };
}

/**
 * The kind a draft saves with. A stored or chip-chosen kind always stays; a kind
 * only read from old words stays while the pair still reads as it ("mum" /
 * "daughter" is none; to keep a kind with your own words, tap its chip first).
 */
export function draftKind(draft: Pick<TieDraft, "label" | "ownLabel" | "kind" | "kindRead">): TieKind | undefined {
  const { kind } = draft;
  if (!kind || !draft.kindRead) return kind;
  return kindOfWords(draft.ownLabel, draft.label) === kind ? kind : undefined;
}

/** Whether `preset`'s chip shows pressed: the draft saves with its kind and holds its word for the other Person. */
export const presetPressed = (draft: TieDraft, preset: Preset): boolean => draftKind(draft) === preset.kind && norm(draft.label) === preset.word;

/**
 * Tap a chip: fill both words and the kind (`own` is this Person's gender
 * reading); tap the pressed one again to clear the kind and leave the words.
 */
export function selectPreset(draft: TieDraft, preset: Preset, own: Gender): TieDraft {
  const { kind: _kind, kindRead: _read, ...rest } = draft;
  if (presetPressed(draft, preset)) return rest;
  const { label, ownLabel, kind } = presetWords(preset, own);
  return { ...rest, label, ownLabel, kind };
}

/**
 * A suggestion dismissed for good (ADR 0130), held on a Person under
 * `dismissedTies`: this Person would have been `kind` of `otherId`. Written
 * on both People of the pair; either one hides it.
 */
export interface Dismissal {
  otherId: string;
  kind: TieKind;
}

/** A Person's dismissals as stored, keeping only well-formed ones whatever a row holds. */
export function dismissalsOf(raw: unknown): Dismissal[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((d): d is Dismissal => typeof d === "object" && d !== null && typeof d.otherId === "string" && typeof d.kind === "string" && Object.hasOwn(KIND_WORDS, d.kind));
}

/** A Suggested Tie as a Person's page shows it: like a TieRow, before it exists. */
export interface SuggestedTie {
  otherId: string;
  otherName: string;
  /** What this Person would be to the other, as `TieRow.kind`. */
  kind: TieKind;
  /** The other Person's word ("sister": "Lily is Tom's sister"). */
  label: string;
  /** This Person's word ("brother"). */
  ownLabel: string;
}

/** A Tie that follows: `from` is `to`'s `kind`. */
interface Deduced {
  from: string;
  to: string;
  kind: TieKind;
}

/**
 * The rules (ADR 0130), each one step, in order: for a Person `x` and `of(y, k)`
 * (the People who are y's k), the People who follow and what they are to `x`.
 */
const RULES: ((x: string, of: (y: string, k: TieKind) => string[]) => [string, TieKind][])[] = [
  // 1. Children of a shared parent are siblings.
  (x, of) => of(x, "parent").flatMap((p) => of(p, "child").map((c): [string, TieKind] => [c, "sibling"])),
  // 2. A parent's parent is a grandparent.
  (x, of) => of(x, "parent").flatMap((p) => of(p, "parent").map((g): [string, TieKind] => [g, "grandparent"])),
  // 3. A parent's sibling is an aunt or uncle.
  (x, of) => of(x, "parent").flatMap((p) => of(p, "sibling").map((s): [string, TieKind] => [s, "auntUncle"])),
  // 4. A parent's sibling's child is a cousin.
  (x, of) => of(x, "parent").flatMap((p) => of(p, "sibling").flatMap((s) => of(s, "child").map((c): [string, TieKind] => [c, "cousin"]))),
  // 5. A sibling's parent is a parent.
  (x, of) => of(x, "sibling").flatMap((s) => of(s, "parent").map((p): [string, TieKind] => [p, "parent"])),
  // 6. A parent's partner is a parent (a step-parent is rare: Dismiss it).
  (x, of) => of(x, "parent").flatMap((p) => of(p, "partner").map((q): [string, TieKind] => [q, "parent"])),
];

const pairKey = (x: string, y: string) => (x < y ? `${x} ${y}` : `${y} ${x}`);

/**
 * The Ties that follow from the kinded ones, as `personId`'s Ties card offers
 * them (ADR 0130): derived, never stored. One per pair, by rule order; never for
 * a pair already tied in any way, a Person to themselves, someone not in
 * `people` (the current Workspace), or a dismissal either Person holds. In name order.
 */
export function suggestedTies(personId: string, ties: readonly Tie[], people: readonly (Pick<Person, "id" | "title"> & { dismissedTies?: unknown })[]): SuggestedTie[] {
  const byId = new Map(people.map((p) => [p.id, p]));
  if (!byId.has(personId)) return [];
  const tied = new Set(ties.map((t) => pairKey(t.a, t.b)));
  const edges: Deduced[] = [];
  for (const t of ties) {
    const kind = tieKindOf(t);
    if (!kind || !byId.has(t.a) || !byId.has(t.b) || t.a === t.b) continue;
    edges.push({ from: t.a, to: t.b, kind }, { from: t.b, to: t.a, kind: invertKind(kind) });
  }
  const of = (y: string, k: TieKind) => edges.filter((e) => e.to === y && e.kind === k).map((e) => e.from);
  const dismissed = (by: string, other: string, kind: TieKind) => dismissalsOf(byId.get(by)?.dismissedTies).some((d) => d.otherId === other && d.kind === kind);
  // Every Person's deductions, rule by rule, so the first rule to give a pair is the one kept, seen from either end.
  const chosen = new Map<string, Deduced>();
  for (const rule of RULES) {
    for (const x of byId.keys()) {
      for (const [from, kind] of rule(x, of)) {
        const key = pairKey(from, x);
        if (from === x || tied.has(key) || chosen.has(key)) continue;
        // `x` would be `invertKind(kind)` of `from`; `from` would be `kind` of `x`.
        if (dismissed(x, from, invertKind(kind)) || dismissed(from, x, kind)) continue;
        chosen.set(key, { from, to: x, kind });
      }
    }
  }
  const word = (id: string) => GENDER_INDEX[genderOf(id, ties)];
  return [...chosen.values()]
    .filter((d) => d.from === personId || d.to === personId)
    .map((d) => {
      // Read from the page's Person: the other is `kind` of them.
      const [otherId, kind] = d.to === personId ? [d.from, d.kind] : [d.to, invertKind(d.kind)];
      return { otherId, otherName: byId.get(otherId)!.title, kind: invertKind(kind), label: KIND_WORDS[kind].a[word(otherId)], ownLabel: KIND_WORDS[kind].b[word(personId)] };
    })
    .sort((x, y) => x.otherName.localeCompare(y.otherName));
}
