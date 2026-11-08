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
