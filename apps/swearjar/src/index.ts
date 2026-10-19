import type { AppManifest, Document, DocumentTypeDef } from "@lifeline/core";
import { COLOR_SLOTS } from "@lifeline/ui";
import { Coins, Gavel, PiggyBank } from "lucide-react";
import { SwearJarScreen } from "./screens/SwearJarScreen";
import { JarCard } from "./cards/JarCard";
import { swearjarCommands } from "./commands";
import { FinePeek } from "./components/FinePeek";
import { swearjarDaylog } from "./daylog";
import { formatCents } from "./domain/money";
import { dayKeyOf } from "./domain/derive";
import { refuseDeletingUsedOffence } from "./data/repo";
import { APP_ID, FINE, OFFENCE, SWEARJAR_HREF, type Fine, type Offence } from "./domain/types";

/**
 * The `swearjar_offence` Document type (ADR 0083): a named, priced thing the
 * user fines themself for. Linkable, bodiless. `archived` is the App's
 * (guarded); the `onDelete` guard refuses deleting one that has Fines, from
 * wherever the delete comes.
 */
const offenceType: DocumentTypeDef = {
  id: OFFENCE,
  label: "Offences",
  icon: Gavel,
  titleRule: "derived",
  titleOf: (d) => (d as Offence).name,
  body: "none",
  fields: [
    { key: "name", label: "Name", kind: "text", required: true, column: true },
    { key: "price", label: "Price (cents)", kind: "number", required: true, column: true },
    { key: "emoji", label: "Emoji", kind: "text" },
    { key: "color", label: "Colour", kind: "select", options: [{ value: "", label: "—" }, ...COLOR_SLOTS.map((c) => ({ value: c, label: c }))] },
    { key: "archived", label: "Archived", kind: "boolean", guarded: true, column: true },
  ],
  linkable: { subtitle: (d) => formatCents(Number((d as Offence).price) || 0) },
  href: () => SWEARJAR_HREF,
  onDelete: refuseDeletingUsedOffence,
  order: 91,
  builtIn: true,
};

/** The `swearjar_fine` internal type (ADR 0083): one incident, at the price it had when logged. */
const fineType: DocumentTypeDef = {
  id: FINE,
  label: "Fines",
  icon: Coins,
  internal: true,
  titleRule: "derived",
  titleOf: (d: Document) => {
    const f = d as Fine;
    return `${formatCents(Number(f.amount) || 0)} · ${f.occurredAt ? dayKeyOf(f.occurredAt) : ""}`;
  },
  body: "none",
  fields: [
    { key: "offenceId", label: "Offence", kind: "link", linkType: OFFENCE, guarded: true, required: true, column: true },
    { key: "amount", label: "Amount (cents)", kind: "number", guarded: true, required: true, column: true },
    { key: "occurredAt", label: "When", kind: "datetime", required: true, column: true },
    { key: "note", label: "Note", kind: "text", column: true },
  ],
  indexes: ["offenceId"],
  href: () => SWEARJAR_HREF,
  peekEdit: FinePeek,
  order: 92,
  builtIn: true,
};

/** Swear Jar App (ADR 0083): money owed to oneself for things done — trust-based, one calendar month's jar at a time. */
export const swearjarApp: AppManifest = {
  id: APP_ID,
  module: "progress",
  title: "Swear Jar",
  icon: PiggyBank,
  color: "var(--chart-red)",
  types: [offenceType, fineType],
  screens: [{ id: "swearjar.home", title: "Swear Jar", path: "swearjar", icon: PiggyBank, component: SwearJarScreen }],
  cards: [
    {
      id: "swearjar.jar",
      title: "Swear jar",
      description: "This month's jar, and every offence one tap away",
      component: JarCard,
      defaultSize: { w: 3, h: 4 },
      minSize: { w: 2, h: 2 },
    },
  ],
  commands: swearjarCommands,
  daylog: swearjarDaylog,
};

export { FINE, OFFENCE };
export type { Fine, Offence };
