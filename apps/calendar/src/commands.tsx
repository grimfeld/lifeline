import { useMemo } from "react";
import { formatTime, todayStr, type CommandDef } from "@lifeline/core";
import { toast } from "@lifeline/ui";
import { Ban, CalendarPlus, LayoutTemplate, Zap } from "lucide-react";
import { EventDialog } from "./components/EventDialog";
import { EventTemplateDialog } from "./components/EventTemplateDialog";
import { TimeBlockerDialog } from "./components/TimeBlockerDialog";
import { BlockerTemplateDialog } from "./components/BlockerTemplateDialog";
import { addEventFromTemplate, useEventTemplates } from "./data/templates";

function AddEventCommandDialog(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <EventDialog {...props} />;
}

function AddTemplateCommandDialog(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <EventTemplateDialog {...props} />;
}

function AddBlockerCommandDialog(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <TimeBlockerDialog {...props} />;
}

function AddBlockerTemplateCommandDialog(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <BlockerTemplateDialog {...props} />;
}

export const calendarCommands: CommandDef[] = [
  {
    id: "calendar.add-event",
    title: "Add event",
    keywords: ["new", "create", "event", "appointment", "meeting"],
    icon: CalendarPlus,
    dialog: AddEventCommandDialog,
  },
  {
    id: "calendar.add-template",
    title: "New event template",
    keywords: ["template", "preset", "event", "quick add"],
    icon: LayoutTemplate,
    dialog: AddTemplateCommandDialog,
  },
  {
    id: "calendar.add-blocker",
    title: "New time blocker",
    keywords: ["blocker", "block", "busy", "recurring", "unavailable"],
    icon: Ban,
    dialog: AddBlockerCommandDialog,
  },
  {
    id: "calendar.add-blocker-template",
    title: "New blocker template",
    keywords: ["blocker", "template", "travel", "buffer", "band"],
    icon: Ban,
    dialog: AddBlockerTemplateCommandDialog,
  },
];

/** One quick-add command per Event template (ADR 0027): straight onto today. */
export function useTemplateCommands(): CommandDef[] {
  const templates = useEventTemplates();
  return useMemo(
    () =>
      templates.map((t) => ({
        id: `calendar.quick-add.${t.id}`,
        title: `Add today: ${t.title}`,
        keywords: ["quick", "template", "event", t.title.toLowerCase()],
        icon: Zap,
        run: async () => {
          const added = await addEventFromTemplate(t.id, todayStr());
          if (added) toast.success(added.start ? `${added.title} today at ${formatTime(added.start)}` : `${added.title} today`);
        },
        capture: true,
      })),
    [templates],
  );
}
