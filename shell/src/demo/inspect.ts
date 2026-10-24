import { displayTitle, documentsOf, registeredApps, screenRoute, typesOfApp } from "@lifeline/core";

/**
 * What the Demo's e2e suite reads from the running build (shell/e2e/demo.spec.ts):
 * the built bundle cannot be imported from a test, so the Demo hands it the
 * App registry here. Only in the suite's own Demo build (`VITE_DEMO_E2E=1`,
 * playwright.config.ts): the deployed Demo leaves this chunk out. It holds
 * nothing the page doesn't show.
 */

/** An App's main page, and the titles of its Documents — what to look for on screen. */
export interface AppPage {
  app: string;
  route: string;
  titles: string[];
}

/** Every registered App with a page of its own, read from the registry, never a hand list. */
export async function appPages(): Promise<AppPage[]> {
  const out: AppPage[] = [];
  for (const a of registeredApps()) {
    const screen = a.screens.find((s) => !s.hidden && !s.path.includes(":"));
    if (!screen) continue; // Hub: the Vault and the Bases, no App page of its own.
    const titles: string[] = [];
    for (const t of typesOfApp(a.id)) {
      if (t.internal) continue;
      for (const d of await documentsOf(t.id)) {
        const title = displayTitle(d, t);
        // How a page may show it: whole, by its name before " · " (Pocket's
        // "Coffee · W43 2026"), or a dated one by its human date (a Mood Day).
        titles.push(title, title.split(" · ")[0] ?? title);
        if (/^\d{4}-\d{2}-\d{2}$/.test(title))
          titles.push(new Date(`${title}T12:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }));
      }
    }
    out.push({ app: a.id, route: screenRoute(screen), titles });
  }
  return out;
}

declare global {
  interface Window {
    lifelineDemo?: { appPages: typeof appPages };
  }
}

export function exposeForTests(): void {
  window.lifelineDemo = { appPages };
}
