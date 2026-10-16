import { documentsTable, gateRows, getDocument, putDocument, type DocumentInput } from "./store";
import { documentTypeSync } from "./registry";
import { ROLES_KEY, type Document, type DocumentTypeDef, type FieldDef } from "./types";

/**
 * A Role (ADR 0069, CONTEXT.md "Role"): a built-in type's Fields and
 * behaviour lent to a Document of another type, so one Document can be two
 * things — my user-defined Person wears the Library's **Author** Role. A
 * Document keeps exactly one type, which still decides its owner, title, body
 * and Home Module; a Role only adds Fields, which belong to the App that
 * defines the Role. Every Role has a **home type**: the type for Documents
 * that are that and nothing else (Library's Author), whose Documents wear the
 * Role by being of it.
 */
export interface RoleDef {
  /** Slug, immutable. Stored in a Document's `roles`. */
  id: string;
  /** Singular display name ("Author", "Source"). */
  label: string;
  /** The type whose Documents wear this Role by construction. */
  homeType: string;
  /**
   * Other types whose Documents play the Role by construction too, owned
   * elsewhere — every book, film and album is a Source without putting it on.
   */
  playedBy?: string[];
  /** The Fields the Role lends. Keys must not collide with the wearer's own; a collision keeps the wearer's. */
  fields: FieldDef[];
  /** Which other types may wear it. Absent: any Linkable, non-internal type. */
  wearable?: (def: DocumentTypeDef) => boolean;
  /** Owning App id; filled in by the registry. */
  appId?: string;
}

let roles: RoleDef[] = [];

export function registerBuiltinRoles(defs: RoleDef[]): void {
  roles = defs;
}

export function allRoles(): RoleDef[] {
  return roles;
}

export function roleDef(id: string): RoleDef | undefined {
  return roles.find((r) => r.id === id);
}

/** Whether Documents of a type play a Role by construction: its home type, or one it names as playing it. */
export function playsByType(role: RoleDef, type: string): boolean {
  return role.homeType === type || (role.playedBy ?? []).includes(type);
}

/** The Roles a Document wears on top of its type (its own `roles`, known ones only). */
export function wornRoles(doc: Pick<Document, "type"> & { roles?: unknown }): RoleDef[] {
  const ids = Array.isArray(doc.roles) ? (doc.roles as unknown[]).filter((x): x is string => typeof x === "string") : [];
  return roles.filter((r) => ids.includes(r.id) && !playsByType(r, doc.type));
}

/** Every Role a Document plays: the ones its type plays by construction, plus the ones it wears. */
export function rolesOf(doc: Pick<Document, "type"> & { roles?: unknown }): RoleDef[] {
  const home = roles.filter((r) => playsByType(r, doc.type));
  return [...home, ...wornRoles(doc)];
}

export function hasRole(doc: Pick<Document, "type"> & { roles?: unknown }, roleId: string): boolean {
  return rolesOf(doc).some((r) => r.id === roleId);
}

/** Whether Documents of a type may put a Role on. */
export function canWear(def: DocumentTypeDef | undefined, role: RoleDef): boolean {
  if (!def || def.internal || playsByType(role, def.id)) return false;
  return role.wearable ? role.wearable(def) : !!def.linkable;
}

/** The Roles a Document could still put on. */
export function wearableRoles(doc: Document, def: DocumentTypeDef | undefined): RoleDef[] {
  const playing = new Set(rolesOf(doc).map((r) => r.id));
  return roles.filter((r) => !playing.has(r.id) && canWear(def, r));
}

/**
 * A Document's Fields: its type's, then each worn Role's, a key the type
 * already declares kept as the type's. What every generic surface — the
 * editor's form, text mode, the link index — reads instead of `def.fields`.
 */
export function fieldsOfDocument(doc: Pick<Document, "type"> & { roles?: unknown }, def: Pick<DocumentTypeDef, "fields"> | undefined): FieldDef[] {
  const own = def?.fields ?? [];
  const worn = wornRoles(doc);
  if (worn.length === 0) return own;
  const keys = new Set(own.map((f) => f.key));
  const out = [...own];
  for (const r of worn) {
    for (const f of r.fields) {
      if (keys.has(f.key)) continue;
      keys.add(f.key);
      out.push(f);
    }
  }
  return out;
}

/** The type definition as one Document sees it: the same, with its Roles' Fields added. */
export function withRoleFields<D extends Pick<DocumentTypeDef, "fields">>(doc: Pick<Document, "type"> & { roles?: unknown }, def: D | undefined): D | undefined {
  if (!def || wornRoles(doc).length === 0) return def;
  return { ...def, fields: fieldsOfDocument(doc, def) };
}

/**
 * Whether a Document may fill a Link field or argument: `linkRole` asks for
 * a Role (home type or worn), `linkType` for a type or family, neither for
 * any Linkable, non-internal Document.
 */
export function isLinkTarget(target: { linkType?: string | string[]; linkRole?: string }, doc: Pick<Document, "type"> & { roles?: unknown }, def?: DocumentTypeDef): boolean {
  if (target.linkRole) return hasRole(doc, target.linkRole);
  if (target.linkType !== undefined) return (Array.isArray(target.linkType) ? target.linkType : [target.linkType]).includes(doc.type);
  const d = def ?? documentTypeSync(doc.type);
  return !!d?.linkable && !d.internal;
}

/**
 * Every live Document playing a Role in this Workspace — its home type's and
 * every wearer — through the store's gates.
 */
export async function documentsWithRole<T extends Document = Document>(roleId: string): Promise<T[]> {
  const role = roleDef(roleId);
  if (!role) return [];
  const types = [role.homeType, ...(role.playedBy ?? [])];
  const [home, wearers] = await Promise.all([
    Promise.all(types.map((t) => documentsTable().where("[type+deleted]").equals([t, 0]).toArray())).then((l) => l.flat()),
    documentsTable().where(ROLES_KEY).equals(roleId).toArray(),
  ]);
  const seen = new Set<string>();
  const rows = [...home, ...wearers].filter((d) => !d.deleted && !seen.has(d.id) && (seen.add(d.id), true));
  return (await gateRows(rows)) as T[];
}

/** Put a Role on a Document. A no-op when it already plays it or its type may not wear it. */
export async function addRole(id: string, roleId: string): Promise<void> {
  const doc = await getDocument(id);
  const role = roleDef(roleId);
  if (!doc || !role || hasRole(doc, roleId) || !canWear(documentTypeSync(doc.type), role)) return;
  const current = Array.isArray(doc.roles) ? (doc.roles as string[]) : [];
  await putDocument({ ...doc, [ROLES_KEY]: [...current, roleId] } as DocumentInput);
}

/**
 * Take a Role off: the Document stays, the Role's own Fields go. Returns the
 * values dropped, so the caller can offer an undo (`restoreRole`).
 */
export async function removeRole(id: string, roleId: string): Promise<Record<string, unknown> | null> {
  const doc = await getDocument(id);
  const role = roleDef(roleId);
  if (!doc || !role || !wornRoles(doc).some((r) => r.id === roleId)) return null;
  const own = new Set((documentTypeSync(doc.type)?.fields ?? []).map((f) => f.key));
  const dropped: Record<string, unknown> = {};
  const next: Record<string, unknown> = { ...doc, [ROLES_KEY]: (doc.roles as string[]).filter((r) => r !== roleId) };
  for (const f of role.fields) {
    if (own.has(f.key)) continue;
    if (f.key in next) dropped[f.key] = next[f.key];
    delete next[f.key];
  }
  await putDocument(next as DocumentInput);
  return dropped;
}

/** Undo `removeRole`: the Role back on, with the Field values it dropped. */
export async function restoreRole(id: string, roleId: string, dropped: Record<string, unknown>): Promise<void> {
  const doc = await getDocument(id);
  if (!doc) return;
  const current = Array.isArray(doc.roles) ? (doc.roles as string[]) : [];
  await putDocument({ ...doc, ...dropped, [ROLES_KEY]: current.includes(roleId) ? current : [...current, roleId] } as DocumentInput);
}

