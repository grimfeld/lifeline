import { getDocument } from "./documents/store";
import type { CommandArg } from "./manifest";

/**
 * The id of the Person type (ADR 0113), which the Contacts App owns. Core
 * names it so that other Apps' People fields (an Event's With…) can restrict
 * themselves to it without importing Contacts.
 */
export const PERSON_TYPE = "contacts_person";

/** How a People-links argument's entries are named, for an agent with no picker: the rule every link follows. */
export const PEOPLE_HINT = "their name, an alias or an id; each must be only one Person";

/**
 * A Command argument that takes People (an Event's With, a Task's For): a list
 * of links to the Person type, its hint saying `who` they are, then how each is named.
 */
export function peopleArg(key: string, label: string, who: string): CommandArg {
  return { key, label, kind: "links", linkType: PERSON_TYPE, hint: `${who}: ${PEOPLE_HINT}.` };
}

/** The singular of `PEOPLE_HINT`, for an argument that takes one Person. */
export const PERSON_HINT = "their name, an alias or an id; it must be only one Person";

/** The ids a People-links argument holds in a Command's args: its list, or none. */
export function peopleIn(args: Record<string, unknown>, key: string): string[] {
  return (args[key] as string[] | undefined) ?? [];
}

/** The People a Command's result names: `lead` ("with", "for"…) then each one's name, in order; "" when there are none. */
export async function peopleNamed(lead: string, ids: readonly string[] | undefined): Promise<string> {
  const names = (await Promise.all((ids ?? []).map(async (id) => (await getDocument(id))?.title))).filter(Boolean);
  return names.length ? ` ${lead} ${names.join(", ")}` : "";
}
