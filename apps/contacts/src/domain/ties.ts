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
    rows.push({ id: t.id, otherId, otherName, label: mine ? t.labelB : t.labelA, ownLabel: mine ? t.labelA : t.labelB, ...(kind ? { kind: mine ? kind : invertKind(kind) } : {}) });
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
}

/** The Tie dialog as it opens: blank for a new Tie, else the row's other Person, words and kind. */
export const tieDraft = (row: TieRow | undefined): TieDraft =>
  row ? { otherId: row.otherId, label: row.label, ownLabel: row.ownLabel, ...(row.kind ? { kind: row.kind } : {}) } : { otherId: "", label: "", ownLabel: "" };

/** The other Person's name in the dialog: the one picked, else the row's (when they are not among `people`), else none yet. */
export function otherNameOf(people: readonly Pick<Person, "id" | "title">[], otherId: string, row: Pick<TieRow, "otherName"> | undefined): string {
  return people.find((p) => p.id === otherId)?.title ?? row?.otherName ?? "";
}

/** A Tie's kind: the one it carries, else the one its words read as. */
export const tieKindOf = (t: Pick<Tie, "labelA" | "labelB" | "kind">): TieKind | undefined => t.kind ?? kindOfWords(t.labelA, t.labelB);

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

/** Whether `preset`'s chip shows pressed: the draft holds its kind and its word for the other Person. */
export const presetPressed = (draft: TieDraft, preset: Preset): boolean => draft.kind === preset.kind && norm(draft.label) === preset.word;

/**
 * Tap a chip: fill both words and the kind (`own` is this Person's gender
 * reading); tap the pressed one again to clear the kind and leave the words.
 */
export function selectPreset(draft: TieDraft, preset: Preset, own: Gender): TieDraft {
  const { kind: _kind, ...rest } = draft;
  if (presetPressed(draft, preset)) return rest;
  const { label, ownLabel, kind } = presetWords(preset, own);
  return { ...rest, label, ownLabel, kind };
}
