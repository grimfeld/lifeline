import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import GridLayout, { WidthProvider, type Layout } from "react-grid-layout";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  toast,
} from "@lifeline/ui";
import {
  appById,
  cardById,
  db,
  isConfigured,
  newId,
  normalizeLayout,
  put,
  remove,
  resolveSettings,
  useCardInstanceTitle,
  useLiveQuery,
  type CardDef,
  type CardSettings,
  type ScreenLayoutItem,
  type UserScreen,
} from "@lifeline/core";
import { Check, LayoutGrid, MoreHorizontal, Plus, Settings2, Trash2 } from "lucide-react";
import { CardPicker } from "../components/CardPicker";
import { CardSettingsForm } from "../components/CardSettingsForm";

const Grid = WidthProvider(GridLayout);

function InstanceTitle({ def, settings }: { def: CardDef; settings: CardSettings }) {
  return <>{useCardInstanceTitle(def, settings)}</>;
}

function CardBody({ item, configure }: { item: ScreenLayoutItem; configure: () => void }) {
  const def = cardById(item.cardId);
  if (!def) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
        Unknown card: {item.cardId}
      </div>
    );
  }
  const Component = def.component;
  return <Component settings={item.settings ?? {}} configure={configure} />;
}

export function UserScreenPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [configuring, setConfiguring] = useState<string | null>(null);
  const [draft, setDraft] = useState<CardSettings>({});

  const screen = useLiveQuery(
    () => db().collection<UserScreen>("screens").get(id ?? ""),
    [id],
    undefined,
  );

  /** Layout with instance ids and resolved settings (backfills pre-instance layouts, ADR 0008). */
  const items = useMemo(() => normalizeLayout(screen?.layout ?? []), [screen]);

  const layout: Layout[] = useMemo(
    () =>
      items.map((l) => {
        const def = cardById(l.cardId);
        return {
          i: l.instanceId!,
          x: l.x,
          y: l.y,
          w: l.w,
          h: l.h,
          ...(def?.minSize ? { minW: def.minSize.w, minH: def.minSize.h } : {}),
        };
      }),
    [items],
  );

  if (!screen || screen.deleted) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        Screen not found.
      </div>
    );
  }

  async function saveItems(next: ScreenLayoutItem[]) {
    await put<UserScreen>("screens", { ...screen!, layout: next });
  }

  async function saveLayout(next: Layout[]) {
    const byId = new Map(items.map((l) => [l.instanceId!, l]));
    await saveItems(
      next.flatMap((l) => {
        const cur = byId.get(l.i);
        return cur ? [{ ...cur, x: l.x, y: l.y, w: l.w, h: l.h }] : [];
      }),
    );
  }

  async function addCard(cardId: string, settings: CardSettings) {
    const def = cardById(cardId)!;
    const y = Math.max(0, ...items.map((l) => l.y + l.h));
    await saveItems([
      ...items,
      { instanceId: newId(), cardId, settings, x: 0, y, w: def.defaultSize.w, h: def.defaultSize.h },
    ]);
    setPickerOpen(false);
  }

  async function removeInstance(instanceId: string) {
    await saveItems(items.filter((l) => l.instanceId !== instanceId));
  }

  function openConfigure(instanceId: string) {
    const item = items.find((l) => l.instanceId === instanceId);
    if (!item) return;
    setDraft(resolveSettings(cardById(item.cardId)?.settings, item.settings));
    setConfiguring(instanceId);
  }

  async function saveConfigure() {
    const item = items.find((l) => l.instanceId === configuring);
    if (!item) return;
    const def = cardById(item.cardId);
    await saveItems(
      items.map((l) => (l.instanceId === configuring ? { ...l, settings: resolveSettings(def?.settings, draft) } : l)),
    );
    setConfiguring(null);
  }

  async function deleteScreen() {
    await remove("screens", screen!.id);
    toast.success(`Screen "${screen!.name}" deleted`);
    navigate("/");
  }

  const configuringItem = items.find((l) => l.instanceId === configuring);
  const configuringDef = configuringItem ? cardById(configuringItem.cardId) : undefined;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <h1 className="text-lg font-semibold tracking-tight">{screen.name}</h1>
        {editing && <Badge variant="secondary">editing</Badge>}
        <div className="ml-auto flex items-center gap-1">
          {editing && (
            <Button variant="outline" className="h-8" onClick={() => setPickerOpen(true)}>
              <Plus /> Add card
            </Button>
          )}
          <Button
            variant={editing ? "default" : "outline"}
            className="h-8"
            onClick={() => setEditing((e) => !e)}
          >
            {editing ? <Check /> : <LayoutGrid />}
            {editing ? "Done" : "Edit"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="size-8">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" onClick={() => void deleteScreen()}>
                <Trash2 /> Delete screen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {items.length === 0 && (
          <div className="text-muted-foreground flex h-40 flex-col items-center justify-center gap-3 text-sm">
            Empty screen.
            <Button variant="outline" onClick={() => { setEditing(true); setPickerOpen(true); }}>
              <Plus /> Add your first card
            </Button>
          </div>
        )}
        <Grid
          layout={layout}
          cols={12}
          rowHeight={40}
          margin={[8, 8]}
          isDraggable={editing}
          isResizable={editing}
          onLayoutChange={(next: Layout[]) => {
            if (editing) void saveLayout(next);
          }}
        >
          {items.map((l) => {
            const def = cardById(l.cardId);
            const settings = l.settings ?? {};
            const configurable = !!def?.settings;
            const unconfigured = def ? !isConfigured(def.settings, settings) : false;
            return (
              <div key={l.instanceId}>
                <Card className="h-full gap-2 overflow-hidden py-3">
                  <CardHeader className="px-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <span
                        className="size-2 rounded-full"
                        style={{
                          background: def ? (appById(def.appId)?.color ?? "var(--muted-foreground)") : "var(--muted-foreground)",
                        }}
                      />
                      <span className="truncate">{def ? <InstanceTitle def={def} settings={settings} /> : l.cardId}</span>
                      {editing && (
                        <span className="ml-auto flex items-center">
                          {configurable && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-6"
                              aria-label="Configure card"
                              onClick={() => openConfigure(l.instanceId!)}
                            >
                              <Settings2 className="size-3" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-6"
                            aria-label="Remove card"
                            onClick={() => void removeInstance(l.instanceId!)}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="min-h-0 flex-1 overflow-hidden px-3">
                    {unconfigured ? (
                      <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 text-sm">
                        Not configured yet.
                        <Button size="sm" variant="outline" onClick={() => openConfigure(l.instanceId!)}>
                          <Settings2 /> Configure…
                        </Button>
                      </div>
                    ) : (
                      <CardBody item={l} configure={() => openConfigure(l.instanceId!)} />
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </Grid>
      </div>

      <CardPicker open={pickerOpen} onOpenChange={setPickerOpen} onAdd={addCard} />

      <Dialog open={configuring !== null} onOpenChange={(o) => !o && setConfiguring(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configure “{configuringDef?.title ?? "card"}”</DialogTitle>
          </DialogHeader>
          {configuringDef?.settings && <CardSettingsForm schema={configuringDef.settings} value={draft} onChange={setDraft} />}
          <DialogFooter>
            <Button disabled={!isConfigured(configuringDef?.settings, draft)} onClick={() => void saveConfigure()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
