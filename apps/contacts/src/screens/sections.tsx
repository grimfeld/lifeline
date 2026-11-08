import type { ComponentType } from "react";
import type { Person } from "../domain/types";
import { AddressesSection } from "../components/AddressesSection";
import { ContactDetailsSection } from "../components/ContactDetailsSection";
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

/** The sections built so far. */
export const PERSON_SECTIONS: PersonSection[] = [
  { slot: "occasions", component: OccasionsSection },
  { slot: "addresses", component: AddressesSection },
  { slot: "contactDetails", component: ContactDetailsSection },
  { slot: "ties", component: TiesSection },
  { slot: "reports", component: ReportsSection },
];

/** The sections in the page's order. */
export function orderedSections(sections: readonly PersonSection[]): PersonSection[] {
  return [...sections].sort((a, b) => SECTION_SLOTS.indexOf(a.slot) - SECTION_SLOTS.indexOf(b.slot));
}

