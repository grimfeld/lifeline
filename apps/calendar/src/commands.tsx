import type { CommandDef } from "@lifeline/core";
import { CalendarPlus } from "lucide-react";
import { EventDialog } from "./components/EventDialog";

function AddEventCommandDialog(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <EventDialog {...props} />;
}

export const calendarCommands: CommandDef[] = [
  {
    id: "calendar.add-event",
    title: "Add event",
    keywords: ["new", "create", "event", "appointment", "meeting"],
    icon: CalendarPlus,
    dialog: AddEventCommandDialog,
  },
];
