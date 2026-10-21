import { useMemo } from "react";
import { formatTime, initialText, todayStr, type CommandDef, type CommandDialogProps } from "@lifeline/core";
import { toast } from "@lifeline/ui";
import { Ban, CalendarPlus, LayoutTemplate, Zap } from "lucide-react";
import { EventDialog } from "./components/EventDialog";
import { EventTemplateDialog } from "./components/EventTemplateDialog";
import { TimeBlockerDialog } from "./components/TimeBlockerDialog";
import { BlockerTemplateDialog } from "./components/BlockerTemplateDialog";
import { addEventFromTemplate, useEventTemplates } from "./data/templates";
import { addEvent } from "./data/repo";
import { eventArgsError } from "./domain/eventForm";
import { EVENT_TEMPLATE_TYPE } from "./domain/types";

function AddEventCommandDialog(props: CommandDialogProps) {
  // What the inline line understood: the title and moment ride the dialog's own prefill, the rest its `initial`.
  const { initial } = props;
  const prefill = useMemo(
    () => ({
      title: initialText(initial, "title") || undefined,
      date: initialText(initial, "date") || undefined,
      start: initialText(initial, "start") || undefined,
      endDate: initialText(initial, "endDate") || undefined,
      end: initialText(initial, "end") || undefined,
    }),
    [initial],
  );
  return <EventDialog {...props} prefill={prefill} />;
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
    capture: true,
    args: [
      { key: "title", label: "Title", kind: "text", required: true },
      { key: "date", label: "Day", kind: "date", required: true, hint: "The (first) day." },
      { key: "start", label: "Start", kind: "time", hint: "Omit for an all-day event." },
      { key: "end", label: "End", kind: "time", hint: "Timed events only: when it ends, on its end day. Must be after the start." },
      {
        key: "endDate",
        label: "End day",
        kind: "date",
        hint: "Timed: the day the end is on, for an Event that runs past midnight or across days (omit for the same day). All-day: the last day, inclusive.",
      },
      { key: "notes", label: "Notes", kind: "longtext" },
      { key: "tags", label: "Tags", kind: "list" },
    ],
    async invoke(a) {
      const start = (a.start as string | undefined) ?? null;
      const end = (a.end as string | undefined) ?? null;
      const endDate = (a.endDate as string | undefined) ?? null;
      const refused = eventArgsError({ date: a.date as string, start, end, endDate });
      if (refused) throw new Error(refused);
      const id = await addEvent({
        title: a.title as string,
        date: a.date as string,
        endDate,
        start,
        end,
        notes: a.notes as string | undefined,
        tags: a.tags as string[] | undefined,
      });
      const at = start ? ` at ${start}${end ? `–${endDate && endDate !== a.date ? `${endDate} ` : ""}${end}` : ""}` : "";
      return { id, message: `Added event “${a.title}” on ${a.date}${at}` };
    },
  },
  {
    // Headless only (no dialog, so neither the palette nor the capture sheet
    // lists it): the per-template quick-adds below are built from data at
    // runtime, which a fixed tool list cannot mirror one by one.
    id: "calendar.add-from-template",
    title: "Add event from a template",
    keywords: ["template", "preset", "event", "quick add"],
    icon: Zap,
    args: [
      { key: "template", label: "Template", kind: "link", linkType: EVENT_TEMPLATE_TYPE, required: true, hint: "Id or exact title of an Event template." },
      { key: "date", label: "Day", kind: "date", hint: "Defaults to today." },
      { key: "start", label: "Start", kind: "time", hint: "Overrides the template's default start; ignored for an all-day template." },
    ],
    async invoke(a) {
      const date = (a.date as string | undefined) ?? todayStr();
      const added = await addEventFromTemplate(a.template as string, date, (a.start as string | undefined) ?? null);
      if (!added) throw new Error("That Event template no longer exists");
      return { id: added.id, message: `Added “${added.title}” on ${date}${added.start ? ` at ${added.start}` : ""}` };
    },
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

/** One quick-add command per Event template (ADR 0027): straight onto today, no dialog. */
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
        // Every template folds under one "Add today…" on the capture sheet;
        // each stays a Command of its own, pinnable and one tap when pinned.
        fold: "calendar.today",
        foldLabel: t.title,
      })),
    [templates],
  );
}
