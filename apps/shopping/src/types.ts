import type { Document, DocumentTypeDef } from "@lifeline/core";
import { ListChecks, ShoppingCart } from "lucide-react";
import { SHOPPING_HREF } from "./constants";
import { releaseAisle } from "./data/repo";

/**
 * A Need (ADR 0055): one thing to buy. Deliberately not Linkable — "milk"
 * is a word, not a subject, and would swallow every `[[milk]]`.
 */
export const needTypeDef: DocumentTypeDef = {
  id: "need",
  label: "Needs",
  icon: ShoppingCart,
  titleRule: "name",
  body: "none",
  href: () => SHOPPING_HREF,
  indexes: ["aisleId"],
  order: 62,
  builtIn: true,
  fields: [
    { key: "note", label: "Note", kind: "text", column: true },
    // An Aisle is a heading, not a link target: set from the App, never a wikilink.
    { key: "aisleId", label: "Aisle", kind: "text", hidden: true },
    { key: "boughtOn", label: "Bought", kind: "date", column: true },
    { key: "listedAt", label: "Listed", kind: "datetime", hidden: true },
  ],
};

/** An Aisle: a loose heading the list is grouped under, in my own order. */
export const aisleTypeDef: DocumentTypeDef = {
  id: "aisle",
  label: "Aisles",
  icon: ListChecks,
  titleRule: "name",
  body: "none",
  href: () => SHOPPING_HREF,
  order: 63,
  builtIn: true,
  fields: [{ key: "rank", label: "Order", kind: "number", column: true }],
  onDelete: async (doc: Document) => releaseAisle(doc.id),
};

export const shoppingTypeDefs: DocumentTypeDef[] = [needTypeDef, aisleTypeDef];
