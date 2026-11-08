import { documentType, reportsIn, useLinkIndex } from "@lifeline/core";
import { DocumentReports } from "@lifeline/editor";
import type { Person } from "../domain/types";
import { PERSON } from "../domain/types";
import { Section } from "./sections";

/**
 * The Person page's Reports (ADR 0112): Last seen and Last mentioned by
 * default, as the Person type chooses them. Two figures, never added together.
 */
export function ReportsSection({ person }: { person: Person }) {
  const index = useLinkIndex();
  const def = documentType(PERSON);
  if (reportsIn(def, "document").length === 0) return null;
  return (
    <Section title="Reports">
      <DocumentReports index={index} def={def} docId={person.id} />
    </Section>
  );
}
