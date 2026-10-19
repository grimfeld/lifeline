import { NavLink } from "react-router";
import { cn } from "@lifeline/ui";
import { appById, appsOfModule, basePath, useDocumentTypes } from "@lifeline/core";
import { Table2 } from "lucide-react";

/**
 * A Module's link down to the raw layer: the Bases of the types its Apps own.
 * A Module links to its Bases but never re-hosts them (ADR 0057).
 */
export function RawDataLinks({ moduleId }: { moduleId: string }) {
  const appIds = new Set(appsOfModule(moduleId).map((a) => a.id));
  const types = useDocumentTypes().filter((t) => !t.internal && t.appId && appIds.has(t.appId));
  if (types.length === 0) return null;
  // Two Apps may name a type alike (Cinema's and the Discotheque's Playlists): those say whose they are.
  const shared = new Set(types.map((t) => t.label).filter((l, i, all) => all.indexOf(l) !== i));
  const label = (t: (typeof types)[number]) => (shared.has(t.label) ? `${t.label} · ${appById(t.appId!)?.title ?? t.appId}` : t.label);
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-muted-foreground px-2 py-1 text-xs font-medium">Raw data</div>
      {types.map((t) => {
        const Icon = t.icon ?? Table2;
        return (
          <NavLink key={t.id} to={basePath(t.id)} className={navRowClass}>
            <Icon className="size-4 shrink-0" /> <span className="min-w-0 truncate">{label(t)}</span>
          </NavLink>
        );
      })}
    </div>
  );
}

export function navRowClass({ isActive }: { isActive: boolean }) {
  return cn(
    "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
    isActive ? "bg-accent text-accent-foreground font-medium" : "hover:bg-accent/50",
  );
}
