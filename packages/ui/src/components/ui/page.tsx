import type * as React from "react";
import { cn } from "../../lib/utils";

/**
 * A page's frame: centred, one column, the same gutter everywhere — `p-4` on a
 * phone, `p-6` on the desk. `reading` (the default) is for lists and text,
 * `wide` for boards, grids and tables. (CODING_STANDARDS.md § UI › Layout)
 */
function Page({
  width = "reading",
  className,
  ...props
}: React.ComponentProps<"div"> & { width?: "reading" | "wide" }) {
  return (
    <div
      data-slot="page"
      data-width={width}
      className={cn(
        "mx-auto grid w-full min-w-0 grid-cols-1 gap-4 p-4 md:p-6",
        width === "wide" ? "max-w-6xl" : "max-w-3xl",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A page's title row: the title, and its actions (children) at the end. A
 * long title wraps beside the actions, which keep their size (ADR 0065).
 * Controls that belong in the Phone dock stay in a `PhoneDock` inside the
 * actions — on a phone they move down, and the title has the row.
 */
function PageHeader({
  title,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & { title: React.ReactNode }) {
  return (
    <div data-slot="page-header" className={cn("flex min-w-0 items-center gap-2", className)} {...props}>
      <h1 className="min-w-0 flex-1 text-xl font-semibold tracking-tight">{title}</h1>
      {children && <div className="flex shrink-0 items-center gap-2 max-md:empty:hidden">{children}</div>}
    </div>
  );
}

/**
 * What an empty list says instead: a short message and, where it makes sense,
 * the action that adds the first one.
 */
function EmptyState({
  action,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { action?: React.ReactNode }) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "text-muted-foreground flex flex-col items-center gap-3 rounded-lg border p-8 text-center text-sm",
        className,
      )}
      {...props}
    >
      <p>{children}</p>
      {action}
    </div>
  );
}

export { Page, PageHeader, EmptyState };
