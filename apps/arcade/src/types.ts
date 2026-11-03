import type { DocumentTypeDef, FieldDef } from "@lifeline/core";
import { Gamepad2 } from "lucide-react";
import { ACQ_LABEL, ACQUISITION, ENGAGEMENT, SETTINGS_TYPE, type Work } from "./domain/types";
import { WORK_TYPES } from "./domain/workTypes";
import { workHref } from "./constants";
import { WorkPeek } from "./components/ArcadePeeks";
import { cascadeWorkDelete } from "./data/repo";

const ENG_LABELS: Record<(typeof ENGAGEMENT)[number], string> = { UNSTARTED: "Not started", IN_PROGRESS: "In progress", DONE: "Done", ABANDONED: "Dropped" };

/**
 * The game type (ADR 0024, type id unchanged from Media — no data
 * migration): both axes, no Nightstand slot. Shelf moves and the
 * auto-stamped days are guarded (ADR 0019).
 */
const WORK_FIELDS: FieldDef[] = [
  { key: "creator", label: "Creator", kind: "text", column: true },
  { key: "year", label: "Year", kind: "number", column: true },
  { key: "size", label: "Size", kind: "number" },
  { key: "acquisition", label: "Owned", kind: "select", options: ACQUISITION.map((v) => ({ value: v, label: ACQ_LABEL[v] })), guarded: true, column: true },
  { key: "engagement", label: "Shelf", kind: "select", options: ENGAGEMENT.map((v) => ({ value: v, label: ENG_LABELS[v] })), guarded: true, column: true },
  { key: "reason", label: "Reason", kind: "longtext" },
  { key: "coverUrl", label: "Cover URL", kind: "url" },
  { key: "externalKey", label: "External key", kind: "text", hidden: true },
  { key: "addedOn", label: "Added on", kind: "date", guarded: true },
  { key: "acquiredOn", label: "Acquired on", kind: "date", guarded: true },
  { key: "startedOn", label: "Started on", kind: "date", guarded: true },
  { key: "finishedOn", label: "Finished on", kind: "date", guarded: true },
];

export const workTypeDefs: DocumentTypeDef[] = WORK_TYPES.map((t) => ({
  id: t.id,
  label: t.plural,
  singular: t.label,
  icon: Gamepad2,
  iconName: "gamepad",
  titleRule: "name",
  body: "none",
  linkable: { subtitle: (d) => { const m = d as Work; return `${t.label}${m.creator ? " · " + m.creator : ""}`; } },
  // Opens on its own page (the Work page); its Peek's "Open" leads there.
  href: (d) => workHref(d.id),
  indexes: ["externalKey"],
  order: 45,
  builtIn: true,
  fields: WORK_FIELDS,
  // Edited where it is peeked, through the Arcade's own controls (ADR 0085).
  peekEdit: WorkPeek,
  // Its Quotes go with it, from wherever it is deleted (ADR 0045).
  onDelete: (doc) => cascadeWorkDelete(doc.id),
}));

export const settingsTypeDef: DocumentTypeDef = {
  id: SETTINGS_TYPE,
  label: "Arcade lookup settings",
  internal: true,
  titleRule: "name",
  body: "none",
  order: 999,
  builtIn: true,
  fields: [{ key: "rawgKey", label: "RAWG key", kind: "text" }],
};
