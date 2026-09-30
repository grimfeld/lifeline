import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
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
  cn,
  toast,
} from "@lifeline/ui";
import { appById, cardById, cardSchema, isConfigured, moveStacked, newId, normalizeLayout, put, remove, resolveSettings, screensOfWorkspace, settingsTags, stackOrder, TagFilterProvider, useCardInstanceTitle, useIsMobile, useLiveQuery, type CardDef, type CardSettings, type ScreenLayoutItem, type UserScreen } from "@lifeline/core";
import {
  Check,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  Minus,
  MoreHorizontal,
  Plus,
  Settings2,
  Tag,
  Trash2,
} from "lucide-react";
import { TagChips } from "@lifeline/ui";
import { TagPicker } from "../components/TagPicker";
import { CardPicker } from "../components/CardPicker";
import { CardSettingsForm } from "../components/CardSettingsForm";

const Grid = WidthProvider(GridLayout);

/** The grid's row and gutter, in px — the phone stack keeps a card's height in the same units. */
const ROW = 40;
const GUTTER = 8;
/** Rows a card may be shrunk / grown to on the phone, where the grid's handles are absent. */
const MIN_ROWS = 2;
const MAX_ROWS = 24;
/** What the phone's editing strip costs a card (its buttons, the Card's gutter), given back to the card so its body keeps the height it was given. */
const EDIT_STRIP = 48;

function rowsToPx(h: number): number {
  return h * ROW + (h - 1) * GUTTER;
}

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

/**
 * One placed Card, the same on the grid and in the phone's stack: `actions` ride
 * in the title row (the grid's editing chrome), `toolbar` sits under the header
 * (the phone's, which needs room the title row does not have).
 */
function ScreenCard({
  item,
  actions,
  toolbar,
  className,
  style,
  onConfigure,
}: {
  item: ScreenLayoutItem;
  actions?: ReactNode;
  toolbar?: ReactNode;
  className?: string;
  style?: CSSProperties;
  onConfigure: () => void;
}) {
  const def = cardById(item.cardId);
  const settings = item.settings ?? {};
  const unconfigured = def ? !isConfigured(cardSchema(def), settings) : false;
  return (
    <Card className={cn("gap-2 overflow-hidden py-3", className)} style={style}>
      <CardHeader className="px-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ background: def ? (appById(def.appId)?.color ?? "var(--muted-foreground)") : "var(--muted-foreground)" }}
          />
          <span className="truncate">{def ? <InstanceTitle def={def} settings={settings} /> : item.cardId}</span>
          {actions}
        </CardTitle>
      </CardHeader>
      {toolbar}
      <CardContent className="min-h-0 flex-1 overflow-hidden px-3">
        {unconfigured ? (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 text-sm">
            Not configured yet.
            <Button size="sm" variant="outline" onClick={onConfigure}>
              <Settings2 /> Configure…
            </Button>
          </div>
        ) : (
          <CardBody item={item} configure={onConfigure} />
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Phone rendering (ADR 0021): the Screen's cards in one column, in the grid's own
 * order. Editing is the same Screen edited without a drag — a card moves a place
 * at a time, grows and shrinks by a row, and configures and removes itself from a
 * strip under its title. Width is desk work; here every card is the screen's.
 */
function StackedItems({
  items,
  editing,
  onMove,
  onResize,
  onConfigure,
  onRemove,
}: {
  items: ScreenLayoutItem[];
  editing: boolean;
  onMove: (instanceId: string, dir: -1 | 1) => void;
  onResize: (instanceId: string, rows: number) => void;
  onConfigure: (instanceId: string) => void;
  onRemove: (instanceId: string) => void;
}) {
  const sorted = stackOrder(items);
  return (
    <div className="flex flex-col gap-2">
      {sorted.map((l, i) => {
        const def = cardById(l.cardId);
        const id = l.instanceId!;
        const minRows = def?.minSize?.h ?? MIN_ROWS;
        return (
          <ScreenCard
            key={id}
            item={l}
            style={{ height: rowsToPx(l.h) + (editing ? EDIT_STRIP : 0) }}
            onConfigure={() => onConfigure(id)}
            toolbar={
              editing && (
                <div className="flex items-center gap-1 border-b px-2 pb-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    aria-label="Move card up"
                    disabled={i === 0}
                    onClick={() => onMove(id, -1)}
                  >
                    <ChevronUp />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    aria-label="Move card down"
                    disabled={i === sorted.length - 1}
                    onClick={() => onMove(id, 1)}
                  >
                    <ChevronDown />
                  </Button>
                  <span className="bg-border mx-1 h-4 w-px" />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    aria-label="Make card shorter"
                    disabled={l.h <= minRows}
                    onClick={() => onResize(id, Math.max(minRows, l.h - 1))}
                  >
                    <Minus />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    aria-label="Make card taller"
                    disabled={l.h >= MAX_ROWS}
                    onClick={() => onResize(id, Math.min(MAX_ROWS, l.h + 1))}
                  >
                    <Plus />
                  </Button>
                  <span className="ml-auto flex items-center">
                    {cardSchema(def) && (
                      <Button size="icon" variant="ghost" className="size-8" aria-label="Configure card" onClick={() => onConfigure(id)}>
                        <Settings2 />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="size-8" aria-label="Remove card" onClick={() => onRemove(id)}>
                      <Trash2 />
                    </Button>
                  </span>
                </div>
              )
            }
          />
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
    // Scoped: a Screen belongs to one Workspace (ADR 0047), so a link to another
    // Workspace's Screen resolves to nothing here rather than rendering its
    // layout against this Workspace's data.
    async () => (await screensOfWorkspace()).find((s) => s.id === id),
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

  /** The phone's re-order: a place at a time, the grid's slots exchanged (ADR 0021). */
  async function moveInstance(instanceId: string, dir: -1 | 1) {
    await saveItems(moveStacked(items, instanceId, dir));
  }

  /** The phone's resize: height only — the stack has no width to give. */
  async function resizeInstance(instanceId: string, rows: number) {
    await saveItems(items.map((l) => (l.instanceId === instanceId ? { ...l, h: rows } : l)));
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
    navigate("/screens");
  }

  const configuringItem = items.find((l) => l.instanceId === configuring);
  const configuringDef = configuringItem ? cardById(configuringItem.cardId) : undefined;

  return (
    <div className="flex h-full flex-col">
      {/* Wraps below `md`: the actions take their own row rather than pushing the name off the screen. */}
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
        <h1 className="truncate text-lg font-semibold tracking-tight">{screen.name}</h1>
        {editing && <Badge variant="secondary">editing</Badge>}
        {editing ? (
          <div className="flex items-center gap-1.5 max-md:order-last max-md:w-full">
            <Tag className="text-muted-foreground size-3.5 shrink-0" />
            <TagPicker
              value={screen.tags ?? []}
              onChange={(t) => void saveScreenTags(t)}
              placeholder="Screen tag filter…"
              className="w-56 max-md:w-full"
            />
          </div>
        ) : (
          <TagChips tags={screen.tags} />
        )}
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
        <TagFilterProvider tags={screen.tags}>
        {isMobile ? (
          <StackedItems
            items={items}
            editing={editing}
            onMove={(instanceId, dir) => void moveInstance(instanceId, dir)}
            onResize={(instanceId, rows) => void resizeInstance(instanceId, rows)}
            onConfigure={openConfigure}
            onRemove={(instanceId) => void removeInstance(instanceId)}
          />
        ) : (
        <Grid
          layout={layout}
          cols={12}
          rowHeight={ROW}
          margin={[GUTTER, GUTTER]}
          isDraggable={editing}
          isResizable={editing}
          draggableCancel=".card-action, input, textarea, select, [role=combobox]"
          onLayoutChange={(next: Layout[]) => {
            if (editing) void saveLayout(next);
          }}
        >
          {items.map((l) => (
            <div key={l.instanceId}>
              <ScreenCard
                item={l}
                className="h-full"
                onConfigure={() => openConfigure(l.instanceId!)}
                actions={
                  editing && (
                    <span className="card-action ml-auto flex items-center">
                      {cardSchema(cardById(l.cardId)) && (
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
                  )
                }
              />
            </div>
          ))}
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
