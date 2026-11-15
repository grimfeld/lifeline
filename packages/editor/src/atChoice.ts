import { aliasesOf, singularOf, type Document, type DocumentTypeDef } from "@lifeline/core";
import type { ComboboxOption } from "@lifeline/ui";

/*
 * What an At field (`AtField`, ADR 0119) offers, apart from how it looks:
 * Places and People together, each said with its type, so "Lidl" the Person
 * is told from "Lidl Prado" the Place.
 */

/** What a Document is, in a word or two: its type's subtitle ("Place · Restaurant", "Person · brother"), else its type's singular. */
export function typeLine(doc: Document, def: DocumentTypeDef | undefined): string {
  const l = def?.linkable;
  const sub = typeof l === "object" ? l.subtitle?.(doc) : undefined;
  return sub || (def ? singularOf(def) : doc.type);
}

/** The options of an At field: every candidate but the chosen one, completed by name or alias. */
export function atOptions(candidates: readonly Document[], chosen: string, defOf: (type: string) => DocumentTypeDef | undefined): ComboboxOption[] {
  return candidates
    .filter((d) => d.id !== chosen)
    .map((d) => {
      const def = defOf(d.type);
      const aliases = aliasesOf(d, def);
      return { value: d.id, label: d.title, keywords: aliases, description: [typeLine(d, def), aliases.length ? `also ${aliases.join(", ")}` : ""].filter(Boolean).join(" · ") };
    });
}
