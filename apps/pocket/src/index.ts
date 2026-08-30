import type { AppManifest, DocumentTypeDef } from "@lifeline/core";
import { COLOR_SLOTS } from "@lifeline/ui";
import { HandCoins, Wallet } from "lucide-react";
import { PocketScreen } from "./screens/PocketScreen";
import { AllowancesCard } from "./cards/PocketCards";
import { pocketCommands } from "./commands";
import { pocketDaylog } from "./daylog";
import { formatCents } from "./domain/money";
import { allowanceTitle, periodLabel } from "./domain/period";
import { ALLOWANCE, APP_ID, PERIOD_KINDS, PERIOD_LABEL, POCKET_HREF, SPEND, type Allowance, type Spend } from "./domain/types";

/**
 * The `pocket_allowance` Document type (ADR 0037): a named sum for one
 * period. Bodiless and Linkable — a daily note can point at
 * "Eating out · September 2026". The period fields are the App's (guarded):
 * `from` is snapped to the period's first day on write and `to` exists for a
 * custom span only; the amount stays plain so a Base can bulk-edit it.
 */
const allowanceType: DocumentTypeDef = {
  id: ALLOWANCE,
  label: "Allowances",
  icon: HandCoins,
  titleRule: "derived",
  titleOf: (d) => allowanceTitle(d as Allowance),
  body: "none",
  fields: [
    { key: "name", label: "Name", kind: "text", required: true, column: true },
    { key: "period", label: "Period", kind: "select", options: PERIOD_KINDS.map((k) => ({ value: k, label: PERIOD_LABEL[k] })), guarded: true, required: true, column: true },
    { key: "from", label: "From", kind: "date", guarded: true, required: true, column: true },
    { key: "to", label: "To (custom only)", kind: "date", guarded: true },
    { key: "amount", label: "Amount (cents)", kind: "number", required: true, column: true },
    { key: "emoji", label: "Emoji", kind: "text" },
    { key: "color", label: "Colour", kind: "select", options: [{ value: "", label: "—" }, ...COLOR_SLOTS.map((c) => ({ value: c, label: c }))] },
  ],
  indexes: ["from"],
  linkable: { subtitle: (d) => `${periodLabel(d as Allowance)} · ${formatCents((d as Allowance).amount)}` },
  href: () => POCKET_HREF,
  order: 85,
  builtIn: true,
};

/** The `pocket_spend` internal type (ADR 0037): one hand-typed amount taken from an Allowance on a day. */
const spendType: DocumentTypeDef = {
  id: SPEND,
  label: "Spends",
  icon: Wallet,
  internal: true,
  titleRule: "derived",
  titleOf: (d) => {
    const s = d as Spend;
    return `${formatCents(Number(s.amount) || 0)} · ${s.label || s.date}`;
  },
  body: "none",
  fields: [
    { key: "allowanceId", label: "Allowance", kind: "link", linkType: ALLOWANCE, guarded: true, required: true, column: true },
    { key: "date", label: "Day", kind: "date", required: true, column: true },
    { key: "amount", label: "Amount (cents)", kind: "number", required: true, column: true },
    { key: "label", label: "Label", kind: "text", column: true },
  ],
  indexes: ["allowanceId", "date"],
  href: () => POCKET_HREF,
  order: 86,
  builtIn: true,
};

/** Pocket App (ADR 0037): the month in hand — Allowances and Spends, beliefs kept apart from the Ledger's facts. */
export const pocketApp: AppManifest = {
  id: APP_ID,
  title: "Pocket",
  icon: HandCoins,
  color: "var(--chart-orange)",
  types: [allowanceType, spendType],
  screens: [{ id: "pocket.home", title: "Pocket", path: "pocket", icon: HandCoins, component: PocketScreen }],
  cards: [
    {
      id: "pocket.allowances",
      title: "Allowances",
      description: "What is running today and what is left of each — tap one to spend from it",
      component: AllowancesCard,
      defaultSize: { w: 3, h: 4 },
      minSize: { w: 2, h: 2 },
    },
  ],
  commands: pocketCommands,
  daylog: pocketDaylog,
};

export { ALLOWANCE, SPEND };
export type { Allowance, Spend };
