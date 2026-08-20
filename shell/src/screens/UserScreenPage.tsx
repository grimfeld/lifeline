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
  cardSchema,
  settingsTags,
  TagFilterProvider,
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
import { Check, LayoutGrid, MoreHorizontal, Plus, Settings2, Tag, Trash2 } from "lucide-react";
import { TagChips } from "@lifeline/ui";
import { TagPicker } from "../components/TagPicker";
import { CardPicker } from "../components/CardPicker";
import { CardSettingsForm } from "../components/CardSettingsForm";
import { useIsMobile } from "../mobile/useIsMobile";

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
  const body = <Component settings={item.settings ?? {}} configure={configure} />;
  // Screen filter ∧ this instance's own `tags` setting (ADR 0014); non-filterable Cards ignore both.
  return def.tagFilterable ? <TagFilterProvider tags={settingsTags(item.settings)}>{body}</TagFilterProvider> : body;
}

/** Phone rendering (grill 2026-08-20): the Screen's cards in one column, read-only — no drag, no resize, no edit. */
function StackedItems({ items }: { items: ScreenLayoutItem[] }) {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  return (
    <div className="flex flex-col gap-2">
      {sorted.map((l) => {
        const def = cardById(l.cardId);
        const settings = l.settings ?? {};
        return (
          <Card key={l.instanceId} className="gap-2 overflow-hidden py-3" style={{ height: l.h * 40 + (l.h - 1) * 8 }}>
            <CardHeader className="px-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <span
                  className="size-2 rounded-full"
                  style={{ background: def ? (appById(def.appId)?.color ?? "var(--muted-foreground)") : "var(--muted-foreground)" }}
                />
                <span className="truncate">{def ? <InstanceTitle def={def} settings={settings} /> : l.cardId}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-hidden px-3">
              <CardBody item={l} configure={() => {}} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function UserScreenPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [configuring, setConfiguring] = useState<string | null>(null);
  const [draft, setDraft] = useState<CardSettings>({});
  const isMobile = useIsMobile();

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
    setDraft(resolveSettings(cardSchema(cardById(item.cardId)), item.settings));
    setConfiguring(instanceId);
  }

  async function saveConfigure() {
    const item = items.find((l) => l.instanceId === configuring);
    if (!item) return;
    const def = cardById(item.cardId);
    await saveItems(
      items.map((l) => (l.instanceId === configuring ? { ...l, settings: resolveSettings(cardSchema(def), draft) } : l)),
    );
    setConfiguring(null);
  }

  async function saveScreenTags(tags: string[]) {
    await put<UserScreen>("screens", { ...screen!, tags });
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
        {editing ? (
          <div className="flex items-center gap-1.5">
            <Tag className="text-muted-foreground size-3.5" />
            <TagPicker value={screen.tags ?? []} onChange={(t) => void saveScreenTags(t)} placeholder="Screen tag filter…" className="w-56" />
          </div>
        ) : (
          <TagChips tags={screen.tags} />
        )}
        <div className="ml-auto flex items-center gap-1 max-md:hidden">
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
        <TagFilterProvider tags={screen.tags}>
        {isMobile ? (
          <StackedItems items={items} />
        ) : (
        <Grid
          layout={layout}
          cols={12}
          rowHeight={40}
          margin={[8, 8]}
          isDraggable={editing}
          isResizable={editing}
          draggableCancel=".card-action, input, textarea, select, [role=combobox]"
          onLayoutChange={(next: Layout[]) => {
            if (editing) void saveLayout(next);
          }}
        >
          {items.map((l) => {
            const def = cardById(l.cardId);
            const settings = l.settings ?? {};
            const schema = cardSchema(def);
            const configurable = !!schema;
            const unconfigured = def ? !isConfigured(schema, settings) : false;
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
                        <span className="card-action ml-auto flex items-center">
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
        )}
        </TagFilterProvider>
      </div>

      <CardPicker open={pickerOpen} onOpenChange={setPickerOpen} onAdd={addCard} />

      <Dialog open={configuring !== null} onOpenChange={(o) => !o && setConfiguring(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configure “{configuringDef?.title ?? "card"}”</DialogTitle>
          </DialogHeader>
          {cardSchema(configuringDef) && <CardSettingsForm schema={cardSchema(configuringDef)!} value={draft} onChange={setDraft} />}
          <DialogFooter>
            <Button disabled={!isConfigured(cardSchema(configuringDef), draft)} onClick={() => void saveConfigure()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
