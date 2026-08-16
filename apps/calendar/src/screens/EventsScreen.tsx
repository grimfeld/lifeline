import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  toast,
} from "@lifeline/ui";
import { addDays, formatHuman, todayStr } from "@lifeline/core";
import { Clock, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import type { Event } from "../domain/types";
import { compareEvents, describeTime, isMultiDay } from "../domain/events";
import { deleteEvent, useEvents } from "../data/repo";
import { EventDialog } from "../components/EventDialog";

function EventRow({ ev, onEdit }: { ev: Event; onEdit: (e: Event) => void }) {
  const today = todayStr();
  const last = isMultiDay(ev) ? ev.endDate! : ev.date;
  const past = last < today;
  return (
    <Card className="py-3">
      <CardContent className="flex items-center gap-3 px-4">
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{ev.title}</div>
          <div className="text-muted-foreground flex items-center gap-1.5 truncate text-xs">
            <Clock className="size-3" /> {describeTime(ev)}
            {ev.notes && <span className="truncate">· {ev.notes}</span>}
          </div>
        </div>
        <Badge variant={past ? "outline" : ev.date === today ? "default" : "secondary"}>
          {ev.date === today ? "Today" : formatHuman(ev.date)}
          {isMultiDay(ev) ? ` → ${formatHuman(ev.endDate!)}` : ""}
        </Badge>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="size-8">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(ev)}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                void deleteEvent(ev.id);
                toast.success("Event deleted");
              }}
            >
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  );
}

function Section({ title, events, onEdit }: { title: string; events: Event[]; onEdit: (e: Event) => void }) {
  if (events.length === 0) return null;
  return (
    <section className="grid gap-2">
      <h2 className="text-muted-foreground text-sm font-medium">{title}</h2>
      {events.map((e) => (
        <EventRow key={e.id} ev={e} onEdit={onEdit} />
      ))}
    </section>
  );
}

export function EventsScreen() {
  const events = useEvents();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Event | undefined>();
  const today = todayStr();

  const groups = useMemo(() => {
    const sorted = [...events].sort(compareEvents);
    const lastDay = (e: Event) => (isMultiDay(e) ? e.endDate! : e.date);
    return {
      today: sorted.filter((e) => e.date <= today && lastDay(e) >= today),
      upcoming: sorted.filter((e) => e.date > today),
      past: sorted.filter((e) => lastDay(e) < today && lastDay(e) >= addDays(today, -30)).reverse(),
    };
  }, [events, today]);

  function edit(e: Event) {
    setEditing(e);
    setDialogOpen(true);
  }

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
        <Button
          onClick={() => {
            setEditing(undefined);
            setDialogOpen(true);
          }}
        >
          <Plus /> New event
        </Button>
      </div>
      {events.length === 0 && (
        <Card>
          <CardContent className="text-muted-foreground p-8 text-center text-sm">
            No events yet. Events show up on the Calendar and Week surfaces.
          </CardContent>
        </Card>
      )}
      <Section title="Today" events={groups.today} onEdit={edit} />
      <Section title="Upcoming" events={groups.upcoming} onEdit={edit} />
      <Section title="Past 30 days" events={groups.past} onEdit={edit} />
      <EventDialog open={dialogOpen} onOpenChange={setDialogOpen} event={editing} />
    </div>
  );
}
