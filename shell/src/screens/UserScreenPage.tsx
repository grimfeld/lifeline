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
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  toast,
} from "@lifeline/ui";
import {
  allCards,
  appById,
  db,
  put,
  remove,
  useLiveQuery,
  type ScreenLayoutItem,
  type UserScreen,
} from "@lifeline/core";
import { Check, LayoutGrid, MoreHorizontal, Plus, Trash2 } from "lucide-react";

const Grid = WidthProvider(GridLayout);

function CardBody({ cardId }: { cardId: string }) {
  const def = allCards().find((c) => c.id === cardId);
  if (!def) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
        Unknown card: {cardId}
      </div>
    );
  }
  const Component = def.component;
  return <Component />;
}

export function UserScreenPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const screen = useLiveQuery(
    () => db().collection<UserScreen>("screens").get(id ?? ""),
    [id],
    undefined,
  );

  const layout: Layout[] = useMemo(
    () =>
      (screen?.layout ?? []).map((l) => ({
        i: l.cardId,
        x: l.x,
        y: l.y,
        w: l.w,
        h: l.h,
        ...(() => {
          const def = allCards().find((c) => c.id === l.cardId);
          return def?.minSize ? { minW: def.minSize.w, minH: def.minSize.h } : {};
        })(),
      })),
    [screen],
  );

  if (!screen || screen.deleted) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        Screen not found.
      </div>
    );
  }

  async function saveLayout(next: Layout[]) {
    const items: ScreenLayoutItem[] = next.map((l) => ({
      cardId: l.i,
      x: l.x,
      y: l.y,
      w: l.w,
      h: l.h,
    }));
    await put<UserScreen>("screens", { ...screen!, layout: items });
  }

  async function addCard(cardId: string) {
    if (screen!.layout.some((l) => l.cardId === cardId)) {
      toast.error("Card already on this screen");
      return;
    }
    const def = allCards().find((c) => c.id === cardId)!;
    const y = Math.max(0, ...screen!.layout.map((l) => l.y + l.h));
    await put<UserScreen>("screens", {
      ...screen!,
      layout: [
        ...screen!.layout,
        { cardId, x: 0, y, w: def.defaultSize.w, h: def.defaultSize.h },
      ],
    });
    setPickerOpen(false);
  }

  async function removeCard(cardId: string) {
    await put<UserScreen>("screens", {
      ...screen!,
      layout: screen!.layout.filter((l) => l.cardId !== cardId),
    });
  }

  async function deleteScreen() {
    await remove("screens", screen!.id);
    toast.success(`Screen "${screen!.name}" deleted`);
    navigate("/");
  }

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
        {screen.layout.length === 0 && (
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
          {screen.layout.map((l) => {
            const def = allCards().find((c) => c.id === l.cardId);
            return (
              <div key={l.cardId}>
                <Card className="h-full gap-2 overflow-hidden py-3">
                  <CardHeader className="px-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <span
                        className="size-2 rounded-full"
                        style={{
                          background: def ? (appById(def.appId)?.color ?? "var(--muted-foreground)") : "var(--muted-foreground)",
                        }}
                      />
                      {def?.title ?? l.cardId}
                      {editing && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="ml-auto size-6"
                          onClick={() => void removeCard(l.cardId)}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="min-h-0 flex-1 overflow-hidden px-3">
                    <CardBody cardId={l.cardId} />
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </Grid>
      </div>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add a card</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            {allCards().map((c) => (
              <button
                key={c.id}
                className="hover:bg-accent flex items-start gap-3 rounded-lg border p-3 text-left"
                onClick={() => void addCard(c.id)}
              >
                <span
                  className="mt-1 size-2 shrink-0 rounded-full"
                  style={{ background: appById(c.appId)?.color ?? "var(--muted-foreground)" }}
                />
                <span>
                  <span className="block text-sm font-medium">{c.title}</span>
                  {c.description && (
                    <span className="text-muted-foreground block text-xs">{c.description}</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
