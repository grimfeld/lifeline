import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { MODULES, currentWorkspaceId, moduleHome, useWorkspaceModules } from "@lifeline/core";

/** Where `/` falls back to with nothing remembered: time is what the app is opened for (ADR 0057). */
export const FALLBACK_PLACE = "/schedule";

// A device that never picked a Workspace has no id yet (it is in the first
// one by default), so it keeps one memory under "default" until it does.
const KEY = (workspaceId: string) => `lifeline:last:${workspaceId || "default"}`;

/**
 * The last place this device stood in a Workspace — per device because it is
 * localStorage, per Workspace by key, so switching Workspace lands where that
 * Workspace was left and the phone never resumes into the desk's Reports.
 */
export function lastPlace(workspaceId: string): string {
  try {
    return localStorage.getItem(KEY(workspaceId)) || FALLBACK_PLACE;
  } catch {
    return FALLBACK_PLACE;
  }
}

/**
 * Remembers where the user is (ADR 0057: `/` resumes) and binds ⌘1…⌘9 to the
 * Rail's Modules in order. Mount once.
 */
export function useResume() {
  const location = useLocation();
  const navigate = useNavigate();
  const modules = useWorkspaceModules();

  // Keyed on the location alone, reading the Workspace at the moment of the
  // move: switching Workspace must not file the page being left under the
  // Workspace being entered, which is what a Workspace dependency would do.
  useEffect(() => {
    if (location.pathname === "/") return;
    try {
      localStorage.setItem(KEY(currentWorkspaceId()), location.pathname + location.search);
    } catch {
      /* private mode */
    }
  }, [location.pathname, location.search]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1) return;
      const m = MODULES.find((x) => x.id === modules[n - 1]);
      if (!m) return;
      e.preventDefault();
      navigate(moduleHome(m));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, modules]);
}
