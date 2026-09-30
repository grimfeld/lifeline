import type { ComponentType, ReactNode } from "react";
import { NavLink } from "react-router";
import { cn } from "@lifeline/ui";
import { screenRoute, screensOf } from "@lifeline/core";
import { navRowClass, RawDataLinks } from "./RawDataLinks";
import type { ModuleShell } from "./shells";

type Icon = ComponentType<{ className?: string }>;

/** One entry in a hand-written Module's navigation: its own page, or one of its Apps' screens under a name the Module chooses. */
export interface ModulePlace {
  key: string;
  title: string;
  icon: Icon;
  /** The Module's own page, relative to `/module/<id>` ("" is its home). */
  page?: string;
  /** Or: the id of the App screen that is this place. */
  screen?: string;
}

/**
 * The common shape of a hand-written Module (ADR 0057): a sidebar of its own
 * places then its raw data on the desk, the same places as tabs across the top
 * on the phone, and its own pages. What makes each Module its own is the list
 * of places, their names, and the pages — above all its home.
 */
export function handModule(opts: {
  id: string;
  title: string;
  places: ModulePlace[];
  pages: ModuleShell["pages"];
}): ModuleShell {
  const resolved = () =>
    opts.places.flatMap((p) => {
      const href =
        p.page !== undefined ? (p.page ? `/module/${opts.id}/${p.page}` : `/module/${opts.id}`) : routeOfScreen(p.screen);
      return href ? [{ ...p, href }] : [];
    });

  function Nav() {
    return (
      <nav className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-2">
        <div className="px-2 pt-1 text-base font-semibold tracking-tight">{opts.title}</div>
        <div className="flex flex-col gap-0.5">
          {resolved().map((p) => (
            <NavLink key={p.key} to={p.href} end className={navRowClass}>
              <p.icon className="size-4" /> {p.title}
            </NavLink>
          ))}
        </div>
        <RawDataLinks moduleId={opts.id} />
      </nav>
    );
  }

  function Tabs() {
    return (
      <div className="flex shrink-0 gap-1 overflow-x-auto border-b px-2 py-1.5 md:hidden">
        {resolved().map((p) => (
          <NavLink
            key={p.key}
            to={p.href}
            end
            className={({ isActive }) =>
              cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs whitespace-nowrap",
                isActive ? "bg-accent text-accent-foreground border-transparent font-medium" : "text-muted-foreground",
              )
            }
          >
            <p.icon className="size-3.5" /> {p.title}
          </NavLink>
        ))}
      </div>
    );
  }

  function Layout({ children, bare = false }: { children: ReactNode; bare?: boolean }) {
    return (
      <>
        <aside className="bg-sidebar text-sidebar-foreground flex w-56 shrink-0 flex-col border-r max-md:hidden">
          <Nav />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <Tabs />
          <main className={cn("min-w-0 flex-1", bare ? "overflow-hidden" : "overflow-y-auto")}>{children}</main>
        </div>
      </>
    );
  }

  return { Layout, Nav, pages: opts.pages };
}

/** An App screen's route; undefined when that App is not registered, so its place is skipped. */
function routeOfScreen(id: string | undefined): string | undefined {
  const s = id ? screensOf().find((x) => x.id === id) : undefined;
  return s && screenRoute(s);
}

/** The heading every Module home opens with. */
export function ModuleHomeHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      {subtitle && <span className="text-muted-foreground text-sm first-letter:uppercase">{subtitle}</span>}
    </div>
  );
}
