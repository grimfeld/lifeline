import { MODULES, type ModuleDef } from "./manifest";

/**
 * Where things to make are listed by Module (ADR 0086), shared by the
 * Selection menu and the Handoff page's picker so the two read alike: the
 * Module the user is in first, then an App in no Module (the Calendar, as on
 * the capture sheet), then the other Modules in Core's order, and
 * user-defined types homed in no Module under **Other** at the end. The order
 * is fixed by where things live, never by use.
 */

/** Core's Modules in order, the one the user is in (if any) moved first. */
export function moduleOrder(currentModule?: string): ModuleDef[] {
  return [...MODULES].sort((a, b) => Number(b.id === currentModule) - Number(a.id === currentModule));
}

/**
 * Groups keyed by a Module's id, `app:<id>` (an App in no Module) or `other`,
 * put in that order: the current Module, the Apps in no Module, the other
 * Modules in Core's order, Other. A key no Module or App names is dropped.
 */
export function orderGroups<T>(
  byGroup: ReadonlyMap<string, T>,
  { appTitle, currentModule }: { appTitle: (appId: string) => string | undefined; currentModule?: string },
): { id: string; title: string; items: T }[] {
  const out: { id: string; title: string; items: T }[] = [];
  const modules = moduleOrder(currentModule);
  const push = (m: ModuleDef) => {
    const items = byGroup.get(m.id);
    if (items !== undefined) out.push({ id: m.id, title: m.title, items });
  };
  const current = modules[0]?.id === currentModule ? modules[0] : undefined;
  if (current) push(current);
  for (const [id, items] of byGroup) {
    if (id.startsWith("app:")) out.push({ id, title: appTitle(id.slice(4)) ?? id.slice(4), items });
  }
  for (const m of modules) if (m !== current) push(m);
  const other = byGroup.get("other");
  if (other !== undefined) out.push({ id: "other", title: "Other", items: other });
  return out;
}

export interface IntakeGroup<I> {
  /** A Module's id, `app:<id>` for an App in no Module, or `other`. */
  id: string;
  title: string;
  intakes: I[];
}

/**
 * Group Intakes by Module. An App's Intake goes under its App's Module; Core's
 * generic Intake for a user-defined type (`module` set, or absent for none)
 * under its Home Module, ahead of the Apps' Intakes there.
 */
export function groupIntakes<I extends { appId: string; module?: string; typeId?: string }>(
  intakes: readonly I[],
  { moduleOf, appTitle, currentModule }: { moduleOf: (appId: string) => string | undefined; appTitle: (appId: string) => string | undefined; currentModule?: string },
): IntakeGroup<I>[] {
  const known = new Set(MODULES.map((m) => m.id));
  const byGroup = new Map<string, I[]>();
  const add = (group: string, i: I) => byGroup.set(group, [...(byGroup.get(group) ?? []), i]);
  // A Module's own types come before its Apps' Intakes.
  for (const i of intakes.filter((i) => i.typeId)) add(i.module && known.has(i.module) ? i.module : "other", i);
  for (const i of intakes.filter((i) => !i.typeId)) {
    const m = moduleOf(i.appId);
    add(m && known.has(m) ? m : `app:${i.appId}`, i);
  }
  return orderGroups(byGroup, { appTitle, currentModule }).map(({ id, title, items }) => ({ id, title, intakes: items }));
}
