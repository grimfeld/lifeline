import type { ReactNode } from "react";

/** One section of the Person page: a sentence-case heading over its content, named by it for assistive tech. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid min-w-0 gap-2" aria-label={title}>
      <h2 className="text-muted-foreground text-sm font-medium">{title}</h2>
      {children}
    </section>
  );
}
