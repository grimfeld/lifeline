import { db, DOCUMENT_TYPES } from "../data/db";
import { put } from "../data/repo";
import { defaultFolder } from "../folders";
import { workspaceScope } from "../workspaces";
import { builtinType, deleteDocumentType, type DocumentTypeRecord } from "./registry";
import { documentsTable, inScope, putDocument } from "./store";
import { TEMPLATE_TYPE, templatesFor } from "./ops";
import { typeDeleteRefusal, type TypeDocumentCount } from "./typeRules";
import type { Document } from "./types";

/**
 * Every live Document of a type in every Workspace, past both gates. Only the
 * type manager reads this, and only to count values and refuse changes
 * (ADR 0072) — never to show the Documents themselves.
 */
export async function documentsOfTypeEverywhere(type: string): Promise<Document[]> {
  return documentsTable().where("[type+deleted]").equals([type, 0]).toArray();
}

export async function countTypeDocuments(type: string): Promise<TypeDocumentCount> {
  const rows = await documentsOfTypeEverywhere(type);
  const scope = await workspaceScope();
  const here = rows.filter((d) => inScope(d, scope)).length;
  return { here, elsewhere: rows.length - here, total: rows.length };
}

/**
 * Delete a user-defined type (ADR 0072): refused while any Document of it is
 * left, in any Workspace. Throws the refusal. Resetting a built-in's
 * customisation is not a delete — use `deleteDocumentType` for that.
 */
export async function deleteUserDocumentType(rec: Pick<DocumentTypeRecord, "id" | "typeId" | "label">): Promise<void> {
  const refusal = typeDeleteRefusal(rec.label, await countTypeDocuments(rec.typeId));
  if (refusal) throw new Error(refusal);
  await deleteDocumentType(rec.id);
}

/**
 * One-time move of a user-defined type's old "body template" text (kept on the
 * type) into a Template of that type (CONTEXT.md "Template"): a user-defined
 * type's starting body comes only from its Templates. Made only when the type
 * has no Template yet in any Workspace, as shared content, then the type's
 * text is cleared. Run once at startup.
 */
export async function migrateTypeTemplates(): Promise<number> {
  const recs = (await db().collection<DocumentTypeRecord>(DOCUMENT_TYPES).where("deleted").equals(0).toArray()).filter(
    (r) => !builtinType(r.typeId) && typeof r.template === "string" && r.template.trim() !== "",
  );
  if (recs.length === 0) return 0;
  const templates = await documentsOfTypeEverywhere(TEMPLATE_TYPE);
  let made = 0;
  for (const r of recs) {
    if (templatesFor(r.typeId, templates).length === 0) {
      await putDocument({ type: TEMPLATE_TYPE, title: r.typeId, folder: defaultFolder(TEMPLATE_TYPE, r.typeId), body: r.template, forType: r.typeId, workspace: "" });
      made++;
    }
    await put<DocumentTypeRecord>(DOCUMENT_TYPES, { ...r, template: "" });
  }
  return made;
}
