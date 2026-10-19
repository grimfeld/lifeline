import { useMemo, useState, type ComponentType } from "react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  PhoneDock,
  Tip,
} from "@lifeline/ui";
import {
  appsOfModule,
  defaultOverview,
  normalizeLayout,
  overviewOf,
  resetOverview,
  saveOverview,
  useCurrentWorkspace,
  type OverviewSlot,
  type ScreenLayoutItem,
} from "@lifeline/core";
import { Check, LayoutGrid, MoreHorizontal, Plus, RotateCcw } from "lucide-react";
import { CardGrid } from "../screens/CardGrid";
import { ModuleHomeHeader } from "./handModule";

/** Whether two layouts place the same Cards the same way — so entering and leaving edit mode alone never makes an Overview the user's own. */
function sameLayout(a: ScreenLayoutItem[], b: ScreenLayoutItem[]): boolean {
  const key = (items: ScreenLayoutItem[]) =>
    JSON.stringify(
      normalizeLayout(items)
        .map(({ instanceId, cardId, settings, title, x, y, w, h }) => ({ instanceId, cardId, settings, title, x, y, w, h }))
        .sort((p, q) => p.instanceId!.localeCompare(q.instanceId!)),
    );
  return key(a) === key(b);
}

/**
 * A Module's Overview (ADR 0066): the page it lands on, Card instances the user
 * may rearrange. The Module hands in its default; the Workspace keeps the
 * user's arrangement once there is one, and Reset to default drops it.
 */
export function overviewPage(opts: {
  moduleId: string;
  /** The heading — the Module's own name for its Overview ("Now", "Today"). */
  title: string;
  /** A line beside the heading, worked out when the page renders (today's date). */
  subtitle?: () => string;
  defaults: OverviewSlot[];
}): ComponentType {
  return function Overview() {
    const ws = useCurrentWorkspace();
    const [editing, setEditing] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const defaults = useMemo(() => defaultOverview(opts.defaults), []);
    const { items, customised } = overviewOf(ws, opts.moduleId, defaults);
    const ownApps = useMemo(() => appsOfModule(opts.moduleId).map((a) => a.id), []);

    async function save(next: ScreenLayoutItem[]) {
      if (sameLayout(next, items)) return;
      await saveOverview(opts.moduleId, next);
    }

    function addFirst() {
      setEditing(true);
      setPickerOpen(true);
    }

    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 p-2 md:p-4">
        <div className="flex flex-wrap items-center gap-2 px-2 pt-2">
          <div className="min-w-0 flex-1">
            <ModuleHomeHeader title={opts.title} subtitle={opts.subtitle?.()} />
          </div>
          <PhoneDock>
            <div className="ml-auto flex items-center gap-1 max-md:contents">
              {editing && (
                <Button variant="outline" className="h-8" onClick={() => setPickerOpen(true)}>
                  <Plus /> Add card
                </Button>
              )}
              <Button variant={editing ? "default" : "outline"} className="h-8" onClick={() => setEditing((e) => !e)}>
                {editing ? <Check /> : <LayoutGrid />}
                {editing ? "Done" : "Edit"}
              </Button>
              {customised && (
                <DropdownMenu>
                  <Tip label="Overview actions">
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                  </Tip>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => void resetOverview(opts.moduleId)}>
                      <RotateCcw /> Reset to default
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </PhoneDock>
        </div>

        {items.length === 0 && (
          <div className="text-muted-foreground flex h-40 flex-col items-center justify-center gap-3 text-sm">
            No cards here.
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={addFirst}>
                <Plus /> Add card
              </Button>
              <Button variant="ghost" onClick={() => void resetOverview(opts.moduleId)}>
                <RotateCcw /> Reset to default
              </Button>
            </div>
          </div>
        )}
        <CardGrid
          items={items}
          save={save}
          editing={editing}
          pickerOpen={pickerOpen}
          onPickerOpenChange={setPickerOpen}
          pickerFirstApps={ownApps}
        />
      </div>
    );
  };
}
