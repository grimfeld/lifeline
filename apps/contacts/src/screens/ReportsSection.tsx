import { documentType, reportsIn, useLinkIndex, type Document } from "@lifeline/core";
import { DocumentReports } from "@lifeline/editor";
import { Section } from "../components/Section";

/**
 * A Person's or a Household's Reports (ADR 0112, ADR 0117, ADR 0131): Last
 * seen, Last talked and Last mentioned by default, as its type chooses them.
 * Three figures, never added together.
 */
export function ReportsSection({ doc }: { doc: Document }) {
  const index = useLinkIndex();
  const def = documentType(doc.type);
  if (reportsIn(def, "document").length === 0) return null;
  return (
    <Section title="Reports">
      <DocumentReports index={index} def={def} docId={doc.id} heading={false} />
    </Section>
  );
}
