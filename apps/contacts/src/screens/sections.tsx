import type { ComponentType, ReactNode } from "react";
import type { Person } from "../domain/types";
import { OccasionsSection } from "../components/OccasionsSection";
import { TiesSection } from "./TiesSection";
import { ReportsSection } from "./ReportsSection";

/**
 * The Person page's sections between its header and its body, in the page's
 * order (#404 story 69): Occasions, Addresses, Contact details, Ties, then
 * Reports. Each later ticket fills its slot by adding one entry to
 * `PERSON_SECTIONS` — #410 Occasions, #411 Addresses and Contact details,
 * #412 Ties, #413 Reports — and the page puts it in its place, whatever order
 * the entries were added in.
 */
export const SECTION_SLOTS = ["occasions", "addresses", "contactDetails", "ties", "reports"] as const;
export type SectionSlot = (typeof SECTION_SLOTS)[number];

export interface PersonSection {
  slot: SectionSlot;
  component: ComponentType<{ person: Person }>;
}

/** The sections built so far; none with #408. */
export const PERSON_SECTIONS: PersonSection[] = [
  { slot: "occasions", component: OccasionsSection },
  { slot: "ties", component: TiesSection },
  { slot: "reports", component: ReportsSection },
];

/** The sections in the page's order. */
export function orderedSections(sections: readonly PersonSection[]): PersonSection[] {
  return [...sections].sort((a, b) => SECTION_SLOTS.indexOf(a.slot) - SECTION_SLOTS.indexOf(b.slot));
}

/** One section of the Person page: a sentence-case heading over its content, named by it for assistive tech. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid min-w-0 gap-2" aria-label={title}>
      <h2 className="text-muted-foreground text-sm font-medium">{title}</h2>
      {children}
    </section>
  );
}
