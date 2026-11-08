import type { ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "@lifeline/ui";
import { personHref } from "../constants";

/** A row of a People list that opens one Person's page: the home's Upcoming, Drifting and Everyone. */
export function PersonRowLink({ personId, className, children }: { personId: string; className?: string; children: ReactNode }) {
  return (
    <Link
      to={personHref(personId)}
      className={cn("hover:bg-accent focus-visible:ring-ring flex min-w-0 items-baseline justify-between gap-3 rounded-lg border p-3 focus-visible:ring-2 focus-visible:outline-none", className)}
    >
      {children}
    </Link>
  );
}

/** A Person's Relationship on a row, after their name. */
export function RelationshipLabel({ children }: { children: ReactNode }) {
  // Half the row at most, so a long Relationship never pushes the name out (ADR 0065); no token is a fraction of a row.
  return <span className="text-muted-foreground min-w-0 max-w-[50%] shrink truncate text-sm">{children}</span>;
}
