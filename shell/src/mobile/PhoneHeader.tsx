import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { moduleById, moduleOfPath, useCurrentWorkspace } from "@lifeline/core";

/**
 * The phone's header (#664): the time, and the open Module's title or, outside
 * a Module, the Workspace's name. None of it is tapped: going between places
 * is the Phone bar's Hub slot, and the Workspace switcher, the Guide and the
 * sync status are in the Hub's grid. A Module's own navigation is in its Phone
 * dock.
 */
export function PhoneHeader() {
  const { pathname } = useLocation();
  const workspace = useCurrentWorkspace();
  const module = moduleById(moduleOfPath(pathname));
  const title = module?.title ?? workspace?.name ?? "Lifeline";
  return (
    // ui-allow: viewport-breakpoint — the phone's own chrome, hidden on the desk by the device's width, as the Phone bar is.
    <header className="bg-background flex h-10 shrink-0 items-center gap-3 border-b px-3 md:hidden">
      <Clock />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{title}</span>
    </header>
  );
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);
  return <time className="text-muted-foreground shrink-0 text-xs tabular-nums">{now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</time>;
}
