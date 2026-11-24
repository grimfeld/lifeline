import type { ComponentType, ReactNode } from "react";
import { moneyShell } from "./money/MoneyModule";
import { progressShell } from "./progress/ProgressModule";
import { houseShell } from "./house/HouseModule";
import { cultureShell } from "./culture/CultureModule";
import { projectsShell } from "./projects/ProjectsModule";
import { journalShell } from "./journal/JournalModule";
import { worldShell } from "./world/WorldModule";

/**
 * A hand-written Module (ADR 0057): its own chrome, and pages of its own. The
 * Apps inside it keep ownership of their types and supply the parts — App
 * screens, Cards, the Surfaces it embeds under its scope — and the Module owns
 * only the arrangement.
 *
 * A Module listed here replaces its stand-in. The Vault is no Module's layout
 * any more (ADR 0068): it is Core's raw editor for bodies.
 */
export interface ModuleShell {
  /**
   * The Module's chrome around whatever it shows — its own pages and its Apps'
   * screens (`/app/...`) alike. `bare` content manages its own scrolling.
   */
  Layout: ComponentType<{ children: ReactNode; bare?: boolean }>;
  /** Its own pages, routed under `/module/<id>/`; the one with path "" is its home. */
  pages: { path: string; component: ComponentType; bare?: boolean }[];
  /** Ids of the App screens (`<app>.<screen>`) its navigation lists as places, so a test can tell when a Module leaves one out. */
  placeScreens: readonly string[];
}

/** Hand-written Modules by id, filled in one at a time as each stand-in is replaced. */
export const MODULE_SHELLS: Record<string, ModuleShell> = {
  money: moneyShell,
  progress: progressShell,
  house: houseShell,
  culture: cultureShell,
  tasks: projectsShell,
  journal: journalShell,
  people: worldShell,
};
