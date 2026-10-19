import type { ComponentType } from "react";
import { builtinType } from "./registry";
import type { DocumentTypeDef, FieldDef, PeekProps } from "./types";

/**
 * The **user's own Fields** of a type (CONTEXT.md "Field"): every Field of a
 * user-defined type; on a built-in, only the ones the user added beside the
 * App's (a "rating" on Book), never the App's own. Core draws and edits these
 * beneath any App's Peek part (ADR 0085), since an App never draws a Field it
 * did not define. A worn Role's Fields are neither: they are the Role's App's.
 */
export function userFieldsOf(def: Pick<DocumentTypeDef, "id" | "fields" | "builtIn"> | undefined): FieldDef[] {
  if (!def) return [];
  if (!def.builtIn) return def.fields;
  const own = new Set((builtinType(def.id)?.fields ?? []).map((f) => f.key));
  return def.fields.filter((f) => !own.has(f.key));
}

/**
 * The owning App's part of a Peek (ADR 0085): its editable one once it has
 * written `peekEdit`, else its read-only `peek` (the fallback while Apps move
 * over one by one), else null — Core lists the App's Fields read-only, or, for
 * a user-defined type, draws the whole Peek editable.
 */
export function peekPartOf(def: Pick<DocumentTypeDef, "peek" | "peekEdit"> | undefined): { Part: ComponentType<PeekProps>; edits: boolean } | null {
  if (def?.peekEdit) return { Part: def.peekEdit, edits: true };
  if (def?.peek) return { Part: def.peek, edits: false };
  return null;
}
