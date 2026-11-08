import type { ReactNode } from "react";

/**
 * One section of a People screen (the home's Upcoming, Drifting and Everyone,
 * each part of a Person's page): a sentence-case heading over its content,
 * named by it for assistive tech. `actions` sit at the heading's end.
 */
export function Section({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  const heading = <h2 className="text-muted-foreground text-sm font-medium">{title}</h2>;
  return (
    <section className="grid min-w-0 gap-2" aria-label={title}>
      {actions ? (
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          {heading}
          {actions}
        </div>
      ) : (
        heading
      )}
      {children}
    </section>
  );
}
