import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  TagChips,
  toast,
} from "@lifeline/ui";
import { formatTime, todayStr } from "@lifeline/core";
import { Ban, Clock, LayoutTemplate, MoreHorizontal, Pencil, Plus, Trash2, Zap } from "lucide-react";
import { describeBlocker, isOneOff } from "../domain/blockers";
import { describeTemplate, durationOf, formatDuration } from "../domain/templates";
import type { BlockerTemplate, EventTemplate, TimeBlocker } from "../domain/types";
import { addEventFromTemplate, deleteEventTemplate, useEventTemplates } from "../data/templates";
import { deleteTimeBlocker, setBlockerActive, useTimeBlockers } from "../data/blockers";
import { deleteBlockerTemplate, useBlockerTemplates } from "../data/blockerTemplates";
import { EventTemplateDialog } from "../components/EventTemplateDialog";
import { TimeBlockerDialog } from "../components/TimeBlockerDialog";
import { BlockerTemplateDialog } from "../components/BlockerTemplateDialog";

function TemplateRow({ t, onEdit }: { t: EventTemplate; onEdit: (t: EventTemplate) => void }) {
  async function quickAdd() {
    const added = await addEventFromTemplate(t.id, todayStr());
    if (added) toast.success(added.start ? `${added.title} today at ${formatTime(added.start)}` : `${added.title} today`);
  }
  return (
    <Card className="py-3">
      <CardContent className="flex items-center gap-3 px-4">
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{t.title}</div>
          <div className="text-muted-foreground flex items-center gap-1.5 truncate text-xs">
            <Clock className="size-3" /> {describeTemplate(t)}
            {t.notes && <span className="truncate">· {t.notes}</span>}
            <TagChips tags={t.tags} size="xs" className="shrink-0" />
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => void quickAdd()}>
          <Zap /> Add today
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="size-8">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(t)}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                void deleteEventTemplate(t.id);
                toast.success("Template deleted");
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

function BlockerTemplateRow({ t, onEdit }: { t: BlockerTemplate; onEdit: (t: BlockerTemplate) => void }) {
  const color = t.color ?? "var(--chart-violet)";
  return (
    <Card className="py-3">
      <CardContent className="flex items-center gap-3 px-4">
        <span
          className="size-3 shrink-0 rounded-sm"
          style={{ background: `repeating-linear-gradient(135deg, color-mix(in oklab, ${color} 60%, transparent) 0 2px, transparent 2px 4px)`, outline: `1px solid ${color}` }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{t.title}</div>
          <div className="text-muted-foreground flex items-center gap-1.5 truncate text-xs">
            <Clock className="size-3" /> {formatDuration(durationOf(t))}
            <TagChips tags={t.tags} size="xs" className="shrink-0" />
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="size-8">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(t)}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                void deleteBlockerTemplate(t.id);
                toast.success("Blocker template deleted");
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

function BlockerRow({ b, onEdit }: { b: TimeBlocker; onEdit: (b: TimeBlocker) => void }) {
  const off = b.active === false;
  const oneOff = isOneOff(b);
  return (
    <Card className="py-3">
      <CardContent className="flex items-center gap-3 px-4">
        <span className="size-3 shrink-0 rounded-full" style={{ background: b.color ?? "var(--chart-violet)", opacity: off ? 0.4 : 1 }} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className={`truncate font-medium ${off ? "text-muted-foreground" : ""}`}>{b.title}</div>
          <div className="text-muted-foreground flex items-center gap-1.5 truncate text-xs">
            {describeBlocker(b)}
            <TagChips tags={b.tags} size="xs" className="shrink-0" />
          </div>
        </div>
        {off && <Badge variant="outline">Off</Badge>}
        {!oneOff && (
          <Button size="sm" variant="outline" onClick={() => void setBlockerActive(b.id, off)}>
            {off ? "Turn on" : "Turn off"}
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="size-8">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(b)}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                void deleteTimeBlocker(b.id);
                toast.success("Blocker deleted");
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

/**
 * One Calendar screen for the two things that make planning quick (ADR
 * 0027): Event templates you add to a day in one gesture, and Time blockers
 * that paint the Schedule with the hours already spoken for.
 */
export function TemplatesScreen() {
  const templates = useEventTemplates();
  const allBlockers = useTimeBlockers();
  const blockerTemplates = useBlockerTemplates();
  const today = todayStr();
  const weekly = allBlockers.filter((b) => !isOneOff(b));
  // One-offs (ADR 0029): upcoming ones are listed; past ones are record and stay in the Base.
  const oneOffs = allBlockers.filter((b) => isOneOff(b) && b.date! >= today);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EventTemplate | undefined>();
  const [blockerOpen, setBlockerOpen] = useState(false);
  const [editingBlocker, setEditingBlocker] = useState<TimeBlocker | undefined>();
  const [blockerTemplateOpen, setBlockerTemplateOpen] = useState(false);
  const [editingBlockerTemplate, setEditingBlockerTemplate] = useState<BlockerTemplate | undefined>();

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Templates & blockers</h1>
        <p className="text-muted-foreground text-sm">Events you add again and again, the hours that are already taken, and the bands you drop around them.</p>
      </div>

      <section className="grid gap-2">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <LayoutTemplate className="size-4" /> Event templates
          </h2>
          <Button
            size="sm"
            onClick={() => {
              setEditingTemplate(undefined);
              setTemplateOpen(true);
            }}
          >
            <Plus /> New template
          </Button>
        </div>
        {templates.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground p-6 text-center text-sm">
              No templates yet. A template is an event shape — title, length, notes, tags — you drop onto a slot on the Schedule or add to today in one click.
            </CardContent>
          </Card>
        ) : (
          templates.map((t) => (
            <TemplateRow
              key={t.id}
              t={t}
              onEdit={(x) => {
                setEditingTemplate(x);
                setTemplateOpen(true);
              }}
            />
          ))
        )}
      </section>

      <section className="grid gap-2">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <Ban className="size-4" /> Time blockers
          </h2>
          <Button
            size="sm"
            onClick={() => {
              setEditingBlocker(undefined);
              setBlockerOpen(true);
            }}
          >
            <Plus /> New blocker
          </Button>
        </div>
        {weekly.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground p-6 text-center text-sm">
              No blockers yet. A blocker is a weekly band — sleep, work hours, the school run — painted behind the Schedule so you plan around it.
            </CardContent>
          </Card>
        ) : (
          weekly.map((b) => (
            <BlockerRow
              key={b.id}
              b={b}
              onEdit={(x) => {
                setEditingBlocker(x);
                setBlockerOpen(true);
              }}
            />
          ))
        )}
      </section>

      <section className="grid gap-2">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <Ban className="size-4" /> Blocker templates
          </h2>
          <Button
            size="sm"
            onClick={() => {
              setEditingBlockerTemplate(undefined);
              setBlockerTemplateOpen(true);
            }}
          >
            <Plus /> New blocker template
          </Button>
        </div>
        {blockerTemplates.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground p-6 text-center text-sm">
              No blocker templates yet. A blocker template is a band you drop again and again — travel, prep, a cooldown — onto an hour of the Schedule; it makes a one-off blocker there.
            </CardContent>
          </Card>
        ) : (
          blockerTemplates.map((t) => (
            <BlockerTemplateRow
              key={t.id}
              t={t}
              onEdit={(x) => {
                setEditingBlockerTemplate(x);
                setBlockerTemplateOpen(true);
              }}
            />
          ))
        )}
        {oneOffs.length > 0 && (
          <div className="mt-2 grid gap-2">
            <h3 className="text-muted-foreground text-xs font-medium">Upcoming one-off blockers</h3>
            {oneOffs.map((b) => (
              <BlockerRow
                key={b.id}
                b={b}
                onEdit={(x) => {
                  setEditingBlocker(x);
                  setBlockerOpen(true);
                }}
              />
            ))}
          </div>
        )}
      </section>

      <EventTemplateDialog open={templateOpen} onOpenChange={setTemplateOpen} template={editingTemplate} />
      <TimeBlockerDialog open={blockerOpen} onOpenChange={setBlockerOpen} blocker={editingBlocker} />
      <BlockerTemplateDialog open={blockerTemplateOpen} onOpenChange={setBlockerTemplateOpen} template={editingBlockerTemplate} />
    </div>
  );
}
