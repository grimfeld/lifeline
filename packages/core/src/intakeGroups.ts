import { MODULES, type ModuleDef } from "./manifest";

/**
 * Where things to make are listed by Module (ADR 0086), shared by the
 * Selection menu and the Handoff page's picker so the two read alike: an App
 * in no Module first (the Calendar, as on the capture sheet), then each Module
 * in Core's order with the one the user is in first, and user-defined types
 * homed in no Module under **Other** at the end. The order is fixed by where
 * things live, never by use.
 */

/** Core's Modules in order, the one the user is in (if any) moved first. */
export function moduleOrder(currentModule?: string): ModuleDef[] {
  return [...MODULES].sort((a, b) => Number(b.id === currentModule) - Number(a.id === currentModule));
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
  const groups: IntakeGroup<I>[] = [];
  for (const [id, list] of byGroup) {
    if (id.startsWith("app:")) groups.push({ id, title: appTitle(id.slice(4)) ?? id.slice(4), intakes: list });
  }
  for (const m of moduleOrder(currentModule)) {
    const list = byGroup.get(m.id);
    if (list) groups.push({ id: m.id, title: m.title, intakes: list });
  }
  const other = byGroup.get("other");
  if (other) groups.push({ id: "other", title: "Other", intakes: other });
  return groups;
}
