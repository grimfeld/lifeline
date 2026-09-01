import type { Document, DocumentTypeDef } from "@lifeline/core";
import { Home, Utensils } from "lucide-react";
import { PANTRY_HREF } from "./constants";
import { STORAGE_KINDS } from "./domain/types";
import { KIND_LABELS } from "./domain/rules";

const kindOptions = STORAGE_KINDS.map((k) => ({ value: k, label: KIND_LABELS[k] }));

/** A Provision (ADR 0043): one product in one Storage, counted, never batched. */
export const provisionTypeDef: DocumentTypeDef = {
  id: "provision",
  label: "Provisions",
  icon: Utensils,
  iconName: "utensils",
  titleRule: "name",
  body: "optional",
  linkable: {
    subtitle: (d: Document) => {
      const q = Number(d.quantity) || 0;
      const unit = typeof d.unit === "string" && d.unit ? ` ${d.unit}` : "";
      return `Provision · ${q}${unit}`;
    },
  },
  href: () => PANTRY_HREF,
  indexes: ["storageId"],
  order: 60,
  builtIn: true,
  fields: [
    { key: "storageId", label: "Storage", kind: "link", linkType: "storage", column: true },
    { key: "quantity", label: "Quantity", kind: "number", column: true },
    { key: "unit", label: "Unit", kind: "text", column: true },
    { key: "minimum", label: "Minimum", kind: "number", column: true },
    { key: "expires", label: "Expires", kind: "date", column: true },
    { key: "frozenOn", label: "Frozen on", kind: "date" },
  ],
};

/** A Storage: a named place of one kind — freezer, fridge or shelf. */
export const storageTypeDef: DocumentTypeDef = {
  id: "storage",
  label: "Storages",
  icon: Home,
  iconName: "home",
  titleRule: "name",
  body: "optional",
  linkable: { subtitle: (d: Document) => KIND_LABELS[(d.kind as keyof typeof KIND_LABELS) ?? "shelf"] ?? "Storage" },
  href: () => PANTRY_HREF,
  order: 61,
  builtIn: true,
  fields: [{ key: "kind", label: "Kind", kind: "select", options: kindOptions, required: true, column: true }],
};

export const pantryTypeDefs: DocumentTypeDef[] = [provisionTypeDef, storageTypeDef];
