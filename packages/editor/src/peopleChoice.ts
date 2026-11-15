import { aliasesOf, type Document } from "@lifeline/core";
import type { ComboboxOption } from "@lifeline/ui";

/*
 * What a People field (`PeopleField`) decides, apart from how it looks: what
 * it offers, and the People it holds after a pick or a key.
 */

/** The People a People field offers: those not chosen yet, completed by name or alias, their aliases said as "also …". */
export function personOptions(people: readonly Document[], chosen: readonly string[]): ComboboxOption[] {
  return people
    .filter((p) => !chosen.includes(p.id))
    .map((p) => {
      const aliases = aliasesOf(p);
      return { value: p.id, label: p.title, keywords: aliases, description: aliases.length ? `also ${aliases.join(", ")}` : undefined };
    });
}

/** The People with one more, or undefined when they hold that one already. */
export function withPerson(chosen: readonly string[], id: string): string[] | undefined {
  return chosen.includes(id) ? undefined : [...chosen, id];
}

/** The People after a key in the field's box: Backspace in an empty box takes the last one off. Undefined when the key changes nothing. */
export function afterKey(key: string, query: string, chosen: readonly string[]): string[] | undefined {
  return key === "Backspace" && !query && chosen.length ? chosen.slice(0, -1) : undefined;
}

/**
 * A Document a People field may offer that stands for People (a Household,
 * ADR 0117): what it is called ("Household"), and the ids of the People it
 * stands for today.
 */
export interface GroupChoice {
  doc: Document;
  kind?: string;
  members: readonly string[];
}

/** Those of `members` a pick would add: People here, not chosen yet, each once. */
function toAdd(chosen: readonly string[], members: readonly string[], people: readonly Document[]): string[] {
  const here = new Set(people.map((p) => p.id));
  const out: string[] = [];
  for (const id of members) if (here.has(id) && !chosen.includes(id) && !out.includes(id)) out.push(id);
  return out;
}

/** The groups a People field offers, completed by name or alias, each saying whom it adds; one that would add no one is left out. */
export function groupOptions(groups: readonly GroupChoice[], people: readonly Document[], chosen: readonly string[]): ComboboxOption[] {
  const names = new Map(people.map((p) => [p.id, p.title]));
  return groups.flatMap((g) => {
    const adds = toAdd(chosen, g.members, people);
    if (!adds.length) return [];
    const who = adds.map((id) => names.get(id)).join(", ");
    return [{ value: g.doc.id, label: g.doc.title, keywords: aliasesOf(g.doc), description: g.kind ? `${g.kind} · ${who}` : who }];
  });
}

/** The People with a group's members added (never the group itself), or undefined when it adds no one. */
export function withMembers(chosen: readonly string[], members: readonly string[], people: readonly Document[]): string[] | undefined {
  const adds = toAdd(chosen, members, people);
  return adds.length ? [...chosen, ...adds] : undefined;
}
