import type { DocumentTypeDef } from "@lifeline/core";
import { Quote as QuoteIcon } from "lucide-react";
import { QUOTES, type Quote } from "./domain/types";
import { WORK_TYPE_IDS } from "./domain/works";
import { quoteName } from "./domain/quotes";
import { APP_HREF } from "./constants";

/**
 * The Quote type (ADR 0024): owned by the Quotes App; the link accepts
 * a work of any family — the type ids belong to the family Apps, but a Link
 * field is data, not behaviour.
 */
export const quoteTypeDef: DocumentTypeDef = {
  id: QUOTES,
  label: "Quotes",
  icon: QuoteIcon,
  iconName: "quote",
  titleRule: "derived",
  titleOf: (d) => `“${quoteName((d as Quote).text ?? "")}”`,
  body: "none",
  linkable: { subtitle: () => "Quote" },
  href: () => APP_HREF,
  indexes: ["mediaId", "capturedOn"],
  order: 46,
  builtIn: true,
  fields: [
    { key: "text", label: "Text", kind: "longtext", required: true, column: true },
    { key: "mediaId", label: "Work", kind: "link", linkType: [...WORK_TYPE_IDS], guarded: true, column: true },
    { key: "locator", label: "Locator", kind: "text", column: true },
    { key: "comment", label: "Comment", kind: "longtext" },
    { key: "capturedOn", label: "Captured on", kind: "date", guarded: true, column: true },
  ],
};
