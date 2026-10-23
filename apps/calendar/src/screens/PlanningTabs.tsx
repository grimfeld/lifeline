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
  Tip,
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
          <Tip label="More actions">
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
          </Tip>
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
          <Tip label="More actions">
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
          </Tip>
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
            <Button size="icon" variant="ghost" aria-label="More actions">
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
 * The Events screen's Templates tab (ADR 0027/0029): the shapes you drop on
 * the Schedule — Event templates that make Events, Blocker templates that
 * make one-off bands.
 */
export function TemplatesTab() {
  const templates = useEventTemplates();
  const blockerTemplates = useBlockerTemplates();
  const [templateOpen, setTemplateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EventTemplate | undefined>();
  const [blockerTemplateOpen, setBlockerTemplateOpen] = useState(false);
  const [editingBlockerTemplate, setEditingBlockerTemplate] = useState<BlockerTemplate | undefined>();

  return (
    <div className="grid gap-8">
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
            <Plus /> New event template
          </Button>
        </div>
        {templates.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground p-6 text-center text-sm">
              No event templates yet. A template is an event shape — title, length, notes, tags — you drop onto a slot on the Schedule or add to today in one click.
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
      </section>

      <EventTemplateDialog open={templateOpen} onOpenChange={setTemplateOpen} template={editingTemplate} />
      <BlockerTemplateDialog open={blockerTemplateOpen} onOpenChange={setBlockerTemplateOpen} template={editingBlockerTemplate} />
    </div>
  );
}

/**
 * The Events screen's Blockers tab (ADR 0027/0029): the weekly rules that
 * paint the Schedule, and the one-off bands still ahead. Past one-offs are
 * record and stay in the Base.
 */
export function BlockersTab() {
  const allBlockers = useTimeBlockers();
  const today = todayStr();
  const weekly = allBlockers.filter((b) => !isOneOff(b));
  const oneOffs = allBlockers.filter((b) => isOneOff(b) && b.date! >= today);
  const [blockerOpen, setBlockerOpen] = useState(false);
  const [editingBlocker, setEditingBlocker] = useState<TimeBlocker | undefined>();
  const edit = (b: TimeBlocker) => {
    setEditingBlocker(b);
    setBlockerOpen(true);
  };

  return (
    <div className="grid gap-8">
      <section className="grid gap-2">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <Ban className="size-4" /> Weekly blockers
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
          weekly.map((b) => <BlockerRow key={b.id} b={b} onEdit={edit} />)
        )}
      </section>

      <section className="grid gap-2">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Clock className="size-4" /> Upcoming one-off blockers
        </h2>
        {oneOffs.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground p-6 text-center text-sm">
              None ahead. Drop a blocker template on an hour of the Schedule to paint a one-off band there.
            </CardContent>
          </Card>
        ) : (
          oneOffs.map((b) => <BlockerRow key={b.id} b={b} onEdit={edit} />)
        )}
      </section>

      <TimeBlockerDialog open={blockerOpen} onOpenChange={setBlockerOpen} blocker={editingBlocker} />
    </div>
  );
}
