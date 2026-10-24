import { MODULES } from "./manifest";
import { orderGroups } from "./intakeGroups";
import { normalizeName } from "./markdown";
import type { LinkIndex } from "./documents/links";
import { maskProse, wikilinkFor } from "./documents/mentions";
import { aliasesOf, type Document, type DocumentTypeDef } from "./documents/types";

/**
 * The **Selection menu** (CONTEXT.md, ADR 0086): what selecting text in a
 * Document's body offers. Pure — the selection and its context go in, the
 * ordered groups come out; the shell only draws them.
 *
 * Top to bottom: **Link** (to the Document the text already names, and
 * "Link to…" a search over every Linkable Document), then the Module the
 * user is in, then a group for each App in no Module (the Calendar, as on the
 * capture sheet), then the other Modules in Core's order, and last **Other**,
 * for user-defined types homed in no Module. A Module's group
 * holds its user-defined types, then its Apps' Intakes. The order is fixed by
 * where things live, never by use.
 */

/** The longest selection a user-defined type is made from: a name, never a paragraph. */
export const QUICK_MAKE_MAX = 80;

/** A user-defined type as the menu needs it. */
export interface MenuUserType {
  id: string;
  /** Its singular label ("Person"). */
  title: string;
  /** Its Home Module, if any (ADR 0068). */
  homeModule?: string;
  /** Whether its Documents are wikilink targets, so the selection becomes a link to the one made. */
  linkable: boolean;
}

/** An Intake as the menu needs it: the registry's, stamped with its App. */
export interface MenuIntake {
  appId: string;
  key: string;
  title: string;
}

export type SelectionEntry<I extends MenuIntake = MenuIntake> =
  /** Wrap the selection in a wikilink to the Document it already names. */
  | { kind: "link"; key: string; title: string; targetId: string; canonical: string; /** The target's title, as shown. */ target: string }
  /** Search every Linkable Document (`linkTargets`) and link the selection to the one picked. */
  | { kind: "search"; key: string; title: string }
  /** Open an App's Intake dialog with the selection as its Handoff. */
  | { kind: "intake"; key: string; title: string; intake: I }
  /** Make a user-defined type's Document at once, titled by the selection — Core's quick make, no Intake (ADR 0086). */
  | { kind: "make"; key: string; title: string; typeId: string; linkable: boolean };

export interface SelectionGroup<I extends MenuIntake = MenuIntake> {
  /** `link`, a Module's id, `app:<id>` for an App in no Module, or `other`. */
  id: string;
  title: string;
  entries: SelectionEntry<I>[];
}

export interface SelectionMenuInput<I extends MenuIntake = MenuIntake> {
  /** The selected text, trimmed. */
  text: string;
  /** The Document it was selected in, and its body as the selection was read from. */
  originId: string;
  body: string;
  /** Where in `body` the selection sits, or null when that is unknown — then nothing is linked. */
  placement: LinkPlacement | null;
  index: LinkIndex;
  /** A type's singular label ("Person"), for "Link to Marie Curie (Person)". */
  typeLabel: (typeId: string) => string | undefined;
  /** Every App's Intakes, in registry order. */
  intakes: I[];
  /** The user-defined types, offered when the selection is short and on one line. */
  userTypes?: MenuUserType[];
  /** The Module an App belongs to, `undefined` for an App in none. */
  moduleOf: (appId: string) => string | undefined;
  appTitle: (appId: string) => string | undefined;
  /** The Module the user is in, if any. */
  currentModule?: string;
  /** What the user typed into the open menu; an entry stays when its name or its group's holds it. */
  query?: string;
}

export function buildSelectionMenu<I extends MenuIntake>(input: SelectionMenuInput<I>): SelectionGroup<I>[] {
  const { intakes, moduleOf, appTitle, currentModule } = input;
  const link = [linkEntry(input), searchEntry(input)].filter((e): e is SelectionEntry<I> => !!e);
  const known = new Set(MODULES.map((m) => m.id));
  const byGroup = new Map<string, SelectionEntry<I>[]>();
  const add = (group: string, e: SelectionEntry<I>) => byGroup.set(group, [...(byGroup.get(group) ?? []), e]);

  if (makesFrom(input.text)) {
    for (const t of input.userTypes ?? []) {
      const e: SelectionEntry<I> = { kind: "make", key: `make:${t.id}`, title: t.title, typeId: t.id, linkable: t.linkable };
      add(t.homeModule && known.has(t.homeModule) ? t.homeModule : "other", e);
    }
  }

  for (const i of intakes) {
    const m = moduleOf(i.appId);
    add(m && known.has(m) ? m : `app:${i.appId}`, { kind: "intake", key: `intake:${i.key}`, title: i.title, intake: i });
  }

  const groups: SelectionGroup<I>[] = link.length ? [{ id: "link", title: "Link", entries: link }] : [];
  for (const { id, title, items } of orderGroups(byGroup, { appTitle, currentModule })) groups.push({ id, title, entries: items });
  return filterMenu(groups, input.query ?? "");
}

/** Whether a user-defined type may be made from this selection: short, and one line. */
function makesFrom(text: string): boolean {
  return text.length > 0 && text.length <= QUICK_MAKE_MAX && !/[\r\n]/.test(text);
}

function filterMenu<I extends MenuIntake>(groups: SelectionGroup<I>[], query: string): SelectionGroup<I>[] {
  const q = normalizeName(query);
  if (!q) return groups;
  const holds = (s: string) => normalizeName(s).includes(q);
  return groups
    .map((g) => (holds(g.title) ? g : { ...g, entries: g.entries.filter((e) => holds(e.title)) }))
    .filter((g) => g.entries.length > 0);
}

/**
 * The Document the text already names (as a wikilink would resolve it), other
 * than the one it was selected in — offered only when the link can be written
 * where the selection is.
 */
function linkEntry<I extends MenuIntake>({ text, originId, body, placement, index, typeLabel }: SelectionMenuInput<I>): SelectionEntry<I> | null {
  const ref = index.resolve(text);
  if (ref.kind !== "doc" || ref.id === originId) return null;
  const name = index.names().find((n) => n.ref.kind === "doc" && n.ref.id === ref.id);
  if (!name || !placement || !writeLink(body, placement, name.canonical)) return null;
  const title = index.byId.get(ref.id)?.title || name.canonical;
  const label = typeLabel(ref.type);
  return { kind: "link", key: `link:${ref.id}`, title: `Link to ${title}${label ? ` (${label})` : ""}`, targetId: ref.id, canonical: name.canonical, target: title };
}

/** "Link to…": offered wherever a link could be written — the text naming nothing, or naming the wrong thing. */
function searchEntry<I extends MenuIntake>({ body, placement }: SelectionMenuInput<I>): SelectionEntry<I> | null {
  if (!placement || !writeLink(body, placement, "x")) return null;
  return { kind: "search", key: "link:search", title: "Link to…" };
}

/** A Document "Link to…" can link to. */
export interface LinkCandidate {
  id: string;
  title: string;
  /** What to write in `[[…]]` (see `LinkName.canonical`). */
  canonical: string;
  type: string;
  subtitle?: string;
}

/**
 * What "Link to…" searches: every Linkable Document once, other than the one
 * the text was selected in, kept when its title or any alias holds `query`
 * (case and accents aside). In the link index's order.
 */
export function linkTargets(index: LinkIndex, originId: string, query: string): LinkCandidate[] {
  const q = normalizeName(query);
  const out = new Map<string, LinkCandidate & { found: boolean }>();
  for (const n of index.names()) {
    if (n.ref.kind !== "doc" || n.ref.id === originId) continue;
    const id = n.ref.id;
    let t = out.get(id);
    if (!t) {
      const title = index.byId.get(id)?.title || n.canonical;
      t = { id, title, canonical: n.canonical, type: n.type, subtitle: n.subtitle, found: !q || normalizeName(title).includes(q) };
      out.set(id, t);
    }
    if (!t.found && normalizeName(n.name).includes(q)) t.found = true;
  }
  return [...out.values()].filter((t) => t.found).map(({ found: _, ...t }) => t);
}

/**
 * The words as a new alias of the target (the Known Field Aliases, under the
 * type's own key): its Aliases with them added, or null when they are its
 * title or one of its aliases already (names compare as wikilinks do) — then
 * "add as alias" is not offered.
 */
export function aliasWrite(words: string, target: Document, def: Pick<DocumentTypeDef, "linkable"> | null | undefined): { key: string; value: string[] } | null {
  const w = normalizeName(words);
  const aliases = aliasesOf(target, def);
  if (!w || w === normalizeName(target.title) || aliases.some((a) => normalizeName(a) === w)) return null;
  const l = def?.linkable;
  const key = typeof l === "object" && l?.aliasesField ? l.aliasesField : "aliases";
  return { key, value: [...aliases, words.trim()] };
}

/**
 * Where in a body the selection sits: exact offsets from an editor, or — from a
 * rendered body, which keeps no offsets — the selected text and which of its
 * plain-prose occurrences on the page it was (`occurrence` of `count`).
 */
export type LinkPlacement = { from: number; to: number } | { text: string; occurrence: number; count: number };

/** A link written into a body: the new body, and the one replacement that made it. */
export interface LinkWrite {
  body: string;
  from: number;
  to: number;
  insert: string;
}

/**
 * Turn the selection into a wikilink to `canonical` (the mentions' rule:
 * `[[Canonical]]` on the title verbatim, else `[[Canonical|words]]`), or null
 * when it cannot be placed. Like an Unlinked mention, it only ever wraps plain
 * prose — never text inside a wikilink, code, a URL or frontmatter — and one
 * line of it. From a rendered body, the occurrence is found by counting: when
 * the page and the body disagree on how often the text occurs (formatting
 * splits it in the source), it would be a guess, so it is refused.
 */
export function writeLink(body: string, at: LinkPlacement, canonical: string): LinkWrite | null {
  const prose = maskProse(body);
  let from: number;
  let to: number;
  if ("from" in at) {
    ({ from, to } = at);
  } else {
    if (!at.text) return null;
    const hits: number[] = [];
    for (let i = prose.indexOf(at.text); i >= 0; i = prose.indexOf(at.text, i + at.text.length)) hits.push(i);
    if (hits.length !== at.count || at.occurrence < 0 || at.occurrence >= hits.length) return null;
    from = hits[at.occurrence]!;
    to = from + at.text.length;
  }
  if (from < 0 || to <= from || to > body.length) return null;
  const text = body.slice(from, to);
  if (prose.slice(from, to) !== text || /[\n[\]|]/.test(text)) return null;
  const insert = wikilinkFor(text, canonical);
  return { body: body.slice(0, from) + insert + body.slice(to), from, to, insert };
}
