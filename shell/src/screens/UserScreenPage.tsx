import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  PhoneDock,
  toast,
} from "@lifeline/ui";
import { put, remove, screensOfWorkspace, TagFilterProvider, useLiveQuery, type ScreenLayoutItem, type UserScreen } from "@lifeline/core";
import { Check, LayoutGrid, MoreHorizontal, Plus, Tag, Trash2 } from "lucide-react";
import { TagChips } from "@lifeline/ui";
import { TagPicker } from "../components/TagPicker";
import { CardGrid } from "./CardGrid";

export function UserScreenPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const screen = useLiveQuery(
    // Scoped: a Screen belongs to one Workspace (ADR 0047), so a link to another
    // Workspace's Screen resolves to nothing here rather than rendering its
    // layout against this Workspace's data.
    async () => (await screensOfWorkspace()).find((s) => s.id === id),
    [id],
    undefined,
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

  async function saveScreenTags(tags: string[]) {
    await put<UserScreen>("screens", { ...screen!, tags });
  }

  async function deleteScreen() {
    await remove("screens", screen!.id);
    toast.success(`Screen "${screen!.name}" deleted`);
    navigate("/screens");
  }

  const items = screen.layout ?? [];

  return (
    <div className="flex h-full flex-col">
      {/* Wraps below `md`: the tag picker takes its own row; the actions sit in the dock. */}
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
        <PhoneDock>
          <div className="ml-auto flex items-center gap-1 max-md:contents">
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
                <Button size="icon" variant="ghost" className="size-8" aria-label="Screen actions" title="Screen actions">
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
        </PhoneDock>
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
          <CardGrid items={items} save={saveItems} editing={editing} pickerOpen={pickerOpen} onPickerOpenChange={setPickerOpen} />
        </TagFilterProvider>
      </div>
    </div>
  );
}
