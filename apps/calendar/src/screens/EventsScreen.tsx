import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import {
  Badge,
  Button,
  Card,
  CardContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  PhoneDock,
  TagChips,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
  Tip,
} from "@lifeline/ui";
import { formatHuman, nowClock, todayStr } from "@lifeline/core";
import { Clock, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import type { Event } from "../domain/types";
import { describeTime, isMultiDay } from "../domain/events";
import { groupEvents, isOver } from "../domain/countdown";
import { deleteEvent, useEvents } from "../data/repo";
import { EventDialog } from "../components/EventDialog";
import { BlockersTab, TemplatesTab } from "./PlanningTabs";

const TABS = ["events", "templates", "blockers"] as const;
type Tab = (typeof TABS)[number];

function EventRow({ ev, onEdit }: { ev: Event; onEdit: (e: Event) => void }) {
  const today = todayStr();
  const past = isOver(ev, { date: today, time: nowClock() });
  return (
    <Card className="py-3">
      <CardContent className="flex items-center gap-3 px-4">
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{ev.title}</div>
          <div className="text-muted-foreground flex items-center gap-1.5 truncate text-xs">
            <Clock className="size-3" /> {describeTime(ev)}
            {ev.notes && <span className="truncate">· {ev.notes}</span>}
            <TagChips tags={ev.tags} size="xs" className="shrink-0" />
          </div>
        </div>
        <Badge variant={past ? "outline" : ev.date <= today ? "default" : "secondary"}>
          {ev.date === today ? "Today" : formatHuman(ev.date)}
          {isMultiDay(ev) ? ` → ${formatHuman(ev.endDate!)}` : ""}
        </Badge>
        <DropdownMenu>
          <Tip label="More actions">
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
          </Tip>
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

/**
 * The Calendar App's one screen: Events, and — as tabs, not screens of their
 * own — the Templates you drop on the Schedule and the Blockers that paint it
 * (ADR 0027/0029). The tab lives in the URL so Bases can deep-link to it.
 */
export function EventsScreen() {
  const events = useEvents();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Event | undefined>();
  const today = todayStr();
  const [params, setParams] = useSearchParams();
  const tab: Tab = (TABS as readonly string[]).includes(params.get("tab") ?? "") ? (params.get("tab") as Tab) : "events";

  const now = nowClock();
  const groups = useMemo(() => groupEvents(events, { date: today, time: now }), [events, today, now]);

  function edit(e: Event) {
    setEditing(e);
    setDialogOpen(true);
  }

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
        {tab === "events" && (
          <PhoneDock>
            <Button
              onClick={() => {
                setEditing(undefined);
                setDialogOpen(true);
              }}
            >
              <Plus /> New event
            </Button>
          </PhoneDock>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setParams(v === "events" ? {} : { tab: v })}>
        <PhoneDock order={1}>
          <TabsList className="md:max-w-full md:overflow-x-auto md:overflow-y-hidden">
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="blockers">Blockers</TabsTrigger>
          </TabsList>
        </PhoneDock>

        <TabsContent value="events" className="grid min-w-0 gap-6 pt-4">
          {events.length === 0 && (
            <Card>
              <CardContent className="text-muted-foreground p-8 text-center text-sm">
                No events yet. Events show up on the Calendar, in every view.
              </CardContent>
            </Card>
          )}
          <Section title="Today" events={groups.today} onEdit={edit} />
          <Section title="Upcoming" events={groups.upcoming} onEdit={edit} />
          <Section title="Past 30 days" events={groups.past} onEdit={edit} />
        </TabsContent>
        <TabsContent value="templates" className="pt-4">
          <TemplatesTab />
        </TabsContent>
        <TabsContent value="blockers" className="pt-4">
          <BlockersTab />
        </TabsContent>
      </Tabs>

      <EventDialog open={dialogOpen} onOpenChange={setDialogOpen} event={editing} />
    </div>
  );
}
