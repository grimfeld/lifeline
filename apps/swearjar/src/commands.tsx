import { pickLinked, type CommandDef, type CommandDialogProps } from "@lifeline/core";
import { Gavel, PiggyBank, Plus } from "lucide-react";
import { SWEARJAR_HREF } from "./domain/types";
import { formatCents } from "./domain/money";
import { allOffences, logFine } from "./data/repo";
import { FineDialog } from "./components/FineDialog";
import { OffenceEditorDialog } from "./components/OffenceEditorDialog";

function FineCommandDialog(props: CommandDialogProps) {
  return <FineDialog {...props} />;
}

function NewOffenceDialog(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <OffenceEditorDialog {...props} />;
}

export const swearjarCommands: CommandDef[] = [
  {
    id: "swearjar.fine",
    title: "Log a fine…",
    keywords: ["swear jar", "fine", "offence", "jar", "swore", "penalty"],
    icon: Gavel,
    dialog: FineCommandDialog,
    capture: true,
    args: [
      { key: "offence", label: "Offence", kind: "text", required: true, hint: "Id or exact name of the Offence; its price is the fine." },
      { key: "date", label: "Day", kind: "date", hint: "Omit for now." },
      { key: "time", label: "Time", kind: "time", hint: "With a day; defaults to noon." },
      { key: "note", label: "Note", kind: "longtext" },
    ],
    async invoke(a) {
      const offences = (await allOffences()).filter((o) => !o.archived);
      const id = pickLinked({ key: "offence", label: "Offence", kind: "link" }, a.offence as string, offences.map((o) => ({ id: o.id, type: o.type, title: o.name })));
      const offence = offences.find((o) => o.id === id)!;
      if (a.time !== undefined && a.date === undefined) throw new Error("A time needs a day");
      const occurredAt = a.date === undefined ? undefined : new Date(`${a.date as string}T${(a.time as string | undefined) ?? "12:00"}`).toISOString();
      if (occurredAt && new Date(occurredAt) > new Date()) throw new Error("A fine is for something that already happened");
      const fineId = await logFine(offence, { occurredAt, note: a.note as string | undefined });
      return { id: fineId, message: `${formatCents(offence.price)} in the jar · ${offence.name}` };
    },
  },
  { id: "swearjar.offence", title: "New offence", keywords: ["swear jar", "offence", "fine", "price"], icon: Plus, dialog: NewOffenceDialog },
  { id: "swearjar.open", title: "Go to Swear Jar", keywords: ["swear jar", "jar", "fines", "offences"], icon: PiggyBank, run: ({ navigate }) => navigate(SWEARJAR_HREF) },
];
