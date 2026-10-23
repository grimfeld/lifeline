import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
  PhoneDock,
  PhoneFilters,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  PageHeader,
  Tip,
  ToggleGroup,
  ToggleGroupItem,
  cn,
  usePhone,
  toast,
} from "@lifeline/ui";
import {
  ALL_VIEW_ID,
  appById,
  applyView,
  availableLayouts,
  COMMON_COLUMNS,
  deleteView,
  layoutFieldCandidates,
  layoutFieldOf,
  layoutPickKey,
  normalizeTags,
  patchDocument,
  removeDocument,
  saveView,
  useDocumentType,
  useDocuments,
  useViews,
  type ViewLayout,
  singularOf,
} from "@lifeline/core";
import { CalendarDays, ChevronDown, Columns3, Images, LayoutGrid, List, MapPin, MoreHorizontal, Plus, Save, Search, Settings2, SquareKanban, Table2, Tag, Trash2 , FolderInput } from "lucide-react";
import { LayoutView } from "./LayoutView";
import { removeEach, refusalSummary } from "./removeEach";
import { FilterBar } from "./FilterBar";
import { sortedBy, stateOf, withColumnToggled, type ViewState } from "./viewState";
import { NewDocumentDialog } from "../vault/NewDocumentDialog";
import { TagPicker } from "../components/TagPicker";
import { MoveToWorkspaceDialog } from "../components/MoveToWorkspace";

const LAYOUT_META: Record<ViewLayout, { icon: typeof Table2; label: string }> = {
  table: { icon: Table2, label: "Table" },
  list: { icon: List, label: "List" },
  cards: { icon: LayoutGrid, label: "Cards" },
  gallery: { icon: Images, label: "Gallery" },
  map: { icon: MapPin, label: "Map" },
  board: { icon: SquareKanban, label: "Board" },
  calendar: { icon: CalendarDays, label: "Calendar" },
};

/**
 * A type's Base (CONTEXT.md "Base"): every Document of the type, with saved
 * Views (filters · search · sort · columns · layout), inline edit of plain
 * fields and bulk actions. `/base/:type?view=<id>`.
 */
export function BasePage() {
  const { type = "" } = useParams<{ type: string }>();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const phone = usePhone();
  const def = useDocumentType(type);
  const docs = useDocuments(type);
  const views = useViews(type);
  const viewId = params.get("view") ?? ALL_VIEW_ID;
  const view = views.find((v) => v.id === viewId);
  const [state, setState] = useState<ViewState>(() => stateOf(view, def));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newOpen, setNewOpen] = useState(false);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameName, setRenameName] = useState("");
  const [tagOpen, setTagOpen] = useState(false);
  const [bulkTags, setBulkTags] = useState<string[]>([]);
  const [moveOpen, setMoveOpen] = useState(false);

  // Re-seed the working state when the selected View (or the type) changes.
  useEffect(() => {
    setState(stateOf(view, def));
    setSelected(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewId, type, view?.updatedAt, def?.id]);

  const rows = useMemo(() => applyView(docs, state, def), [docs, state, def]);
  const dirty = JSON.stringify(stateOf(view, def)) !== JSON.stringify(state);
  const allFields = [...COMMON_COLUMNS, ...(def?.fields ?? []).filter((f) => !f.hidden)];
  const app = def?.appId ? appById(def.appId) : undefined;
  const creatable = !!def && !def.internal && def.titleRule !== "derived" && !def.appId;
  const layouts = availableLayouts(def);
  const pickKey = layoutPickKey(state.layout);
  const pickCandidates = layoutFieldCandidates(def, state.layout);
  const pickedField = layoutFieldOf(state, def, state.layout);
  const pickLabel = state.layout === "gallery" ? "Image" : state.layout === "map" ? "Geo" : state.layout === "board" ? "Group by" : "Date";

  function selectView(id: string) {
    const next = new URLSearchParams(params);
    if (id === ALL_VIEW_ID) next.delete("view");
    else next.set("view", id);
    setParams(next, { replace: true });
  }
  async function saveCurrent() {
    if (!view) return;
    await saveView({ ...view, ...state });
    toast.success(`View “${view.name}” saved`);
  }
  async function saveAs() {
    const name = saveName.trim();
    if (!name) return;
    const v = await saveView({ type, name, ...state, sort: views.length });
    setSaveAsOpen(false);
    setSaveName("");
    selectView(v.id);
  }
  function renameView() {
    if (!view) return;
    setRenameName(view.name);
    setRenameOpen(true);
  }
  async function commitRename() {
    const name = renameName.trim();
    if (!view || !name) return;
    await saveView({ ...view, name });
    setRenameOpen(false);
  }
  function openInApp() {
    if (def?.href) navigate(def.href({ id: "", type, title: "", tags: [], folder: "", createdAt: "", updatedAt: "", deleted: 0 }));
  }
  async function removeView() {
    if (!view) return;
    await deleteView(view.id);
    selectView(ALL_VIEW_ID);
  }
  function toggleSort(key: string) {
    setState((s) => sortedBy(s, key));
  }
  function toggleColumn(key: string) {
    setState((s) => withColumnToggled(s, key));
  }
  const select = (id: string, on: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  async function bulkDelete() {
    const ids = Array.from(selected);
    const { removed, refused } = await removeEach(ids, removeDocument);
    setSelected((s) => new Set(Array.from(s).filter((id) => !removed.includes(id))));
    if (removed.length) toast.success(`${removed.length} deleted`);
    if (refused.length) toast.error(`${refused.length} kept — ${refusalSummary(refused)}`);
  }
  async function bulkTag() {
    const ids = Array.from(selected);
    for (const id of ids) {
      const d = docs.find((x) => x.id === id);
      if (d) await patchDocument(id, { tags: normalizeTags([...d.tags, ...bulkTags]) });
    }
    setTagOpen(false);
    setBulkTags([]);
    toast.success(`Tagged ${ids.length}`);
  }

  if (!def) return <div className="text-muted-foreground flex h-full items-center justify-center text-sm">Unknown Document type “{type}”.</div>;
  const Icon = def.icon;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
        {Icon && <Icon className="text-muted-foreground size-5" />}
        <PageHeader title={def.label} className="w-auto" />
        <Badge variant="secondary">{docs.length}</Badge>
        {def.internal && <Badge variant="outline">internal</Badge>}
        {app && (
          <Badge variant="outline" className="gap-1" title={`Owned by the ${app.title} App`}>
            {app.title}
          </Badge>
        )}
        <PhoneDock>
          <div className="ml-auto flex items-center gap-1 max-md:contents">
            {creatable &&
              (phone ? (
                <Tip label={`New ${singularOf(def).toLowerCase()}`}>
                  <Button size="icon" onClick={() => setNewOpen(true)}>
                    <Plus />
                  </Button>
                </Tip>
              ) : (
                <Button size="sm" onClick={() => setNewOpen(true)}>
                  <Plus /> New {singularOf(def).toLowerCase()}
                </Button>
              ))}
            {/* On a phone these two sit in the views ⋯ menu */}
            {!phone && app && def.href && (
              <Button size="sm" variant="outline" onClick={openInApp}>
                Open in {app.title}
              </Button>
            )}
            {!phone && (
              <Tip label="Document types">
                <Button size="icon" variant="ghost" onClick={() => navigate("/base")}>
                  <Settings2 />
                </Button>
              </Tip>
            )}
          </div>
        </PhoneDock>
      </header>

      {/* Views — on a phone a select of them plus one ⋯ menu for the rest, in the dock */}
      {phone ? (
        <PhoneDock order={1}>
          <Select value={viewId} onValueChange={selectView}>
            <SelectTrigger size="sm" aria-label="View">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VIEW_ID}>All</SelectItem>
              {views.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DropdownMenu>
            <Tip label="View actions">
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant={dirty ? "secondary" : "ghost"}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
            </Tip>
            <DropdownMenuContent align="end" className="min-w-48">
              {dirty && view && (
                <DropdownMenuItem onClick={() => void saveCurrent()}>
                  <Save /> Save “{view.name}”
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setSaveAsOpen(true)}>
                <Plus /> {dirty ? "Save as new view…" : "New view…"}
              </DropdownMenuItem>
              {dirty && <DropdownMenuItem onClick={() => setState(stateOf(view, def))}>Reset</DropdownMenuItem>}
              {view && !dirty && (
                <>
                  <DropdownMenuItem onClick={renameView}>Rename view</DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={() => void removeView()}>
                    <Trash2 /> Delete view
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              {app && def.href && <DropdownMenuItem onClick={openInApp}>Open in {app.title}</DropdownMenuItem>}
              <DropdownMenuItem onClick={() => navigate("/base")}>
                <Settings2 /> Document types
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </PhoneDock>
      ) : (
        <div className="flex flex-wrap items-center gap-1 border-b px-4 py-1.5">
          <ToggleGroup aria-label="View" value={viewId} onValueChange={selectView}>
            <ToggleGroupItem value={ALL_VIEW_ID}>All</ToggleGroupItem>
            {views.map((v) => (
              <ToggleGroupItem key={v.id} value={v.id}>
                {v.name}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Button size="sm" variant="ghost" className="text-xs" onClick={() => setSaveAsOpen(true)}>
            <Plus className="size-3" /> View
          </Button>
          {dirty && (
            <span className="ml-auto flex items-center gap-1">
              {view && (
                <Button size="sm" variant="outline" onClick={() => void saveCurrent()}>
                  <Save /> Save “{view.name}”
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setSaveAsOpen(true)}>
                Save as…
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setState(stateOf(view, def))}>
                Reset
              </Button>
            </span>
          )}
          {view && !dirty && (
            <DropdownMenu>
              <Tip label="View actions">
                <DropdownMenuTrigger asChild>
                  <Button size="icon-sm" variant="ghost" className="ml-auto">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
              </Tip>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={renameView}>
                  Rename view
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={() => void removeView()}>
                  <Trash2 /> Delete view
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}

      {/* Toolbar — likewise: search in the dock, the rest behind Filters */}
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-1.5 max-md:hidden">
        <PhoneDock>
          <div className="relative max-md:basis-28">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2" />
            <Input className="w-48 pl-7 text-xs max-md:h-8 max-md:w-full" placeholder="Search…" value={state.search} onChange={(e) => setState({ ...state, search: e.target.value })} />
          </div>
          <PhoneFilters active={state.filters.length}>
            <FilterBar def={def} filters={state.filters} onChange={(filters) => setState({ ...state, filters })} />
            <div className="ml-auto flex items-center gap-1 max-md:ml-0 max-md:flex-wrap">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" className="text-xs">
                    Sort: {allFields.find((f) => f.key === state.sortBy)?.label ?? state.sortBy} {state.sortDir === "asc" ? "↑" : "↓"} <ChevronDown className="size-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {allFields.map((f) => (
                    <DropdownMenuItem key={f.key} onClick={() => toggleSort(f.key)}>
                      {f.label}
                      {state.sortBy === f.key && <span className="ml-auto text-xs">{state.sortDir}</span>}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" className="text-xs" title="Columns">
                    <Columns3 className="size-3.5" /> Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
                  {allFields.map((f) => (
                    <DropdownMenuItem key={f.key} onSelect={(e) => e.preventDefault()} onClick={() => toggleColumn(f.key)}>
                      <Checkbox checked={state.columns.includes(f.key)} className="pointer-events-none" /> {f.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {pickKey && pickCandidates.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost" className="text-xs" title={`Field the ${LAYOUT_META[state.layout].label} layout reads`}>
                      {pickLabel}: {pickedField?.label ?? "—"} <ChevronDown className="size-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {pickCandidates.map((f) => (
                      <DropdownMenuItem key={f.key} onClick={() => setState({ ...state, [pickKey]: f.key })}>
                        {f.label}
                        {pickedField?.key === f.key && <span className="ml-auto text-xs">✓</span>}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <ToggleGroup aria-label="Layout" value={state.layout} onValueChange={(layout) => setState({ ...state, layout: layout as ViewLayout })}>
                {layouts.map((id) => {
                  const l = LAYOUT_META[id];
                  return (
                    <Tip key={id} label={l.label}>
                      <ToggleGroupItem value={id}>
                        <l.icon className="size-3.5" />
                      </ToggleGroupItem>
                    </Tip>
                  );
                })}
              </ToggleGroup>
            </div>
          </PhoneFilters>
        </PhoneDock>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="bg-accent/40 flex items-center gap-2 border-b px-4 py-1.5 text-sm">
          <span>{selected.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => setTagOpen(true)}>
            <Tag /> Add tags
          </Button>
          <Button size="sm" variant="outline" onClick={() => setMoveOpen(true)}>
            <FolderInput /> Move to workspace
          </Button>
          <Button size="sm" variant="outline" className="text-destructive" onClick={() => void bulkDelete()}>
            <Trash2 /> Delete
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set(rows.map((r) => r.id)))}>
            Select all {rows.length}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      <div className={cn("min-h-0 flex-1", ["map", "board", "calendar"].includes(state.layout) ? "overflow-hidden" : "overflow-auto")}>
        <LayoutView docs={rows} def={def} columns={state.columns} layout={state.layout} picks={state} selected={selected} onSelect={select} onSort={toggleSort} sortBy={state.sortBy} sortDir={state.sortDir} />
      </div>
      <footer className="text-muted-foreground flex items-center gap-2 border-t px-4 py-1 text-xs">
        {rows.length} of {docs.length}
        {def.appId && (
          <span className="ml-auto">
            🔒 guarded fields change only through <Link to={def.href?.({ id: "", type, title: "", tags: [], folder: "", createdAt: "", updatedAt: "", deleted: 0 }) ?? "#"} className="underline">{app?.title}</Link>
          </span>
        )}
      </footer>

      <NewDocumentDialog type={newOpen ? type : null} onOpenChange={(o) => !o && setNewOpen(false)} />
      <Dialog open={saveAsOpen} onOpenChange={setSaveAsOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Save View</DialogTitle>
          </DialogHeader>
          <Input autoFocus placeholder="To read" value={saveName} onChange={(e) => setSaveName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void saveAs()} />
          <DialogFooter>
            <Button onClick={() => void saveAs()} disabled={!saveName.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Rename view</DialogTitle>
          </DialogHeader>
          <Input autoFocus aria-label="View name" value={renameName} onChange={(e) => setRenameName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void commitRename()} />
          <DialogFooter>
            <Button onClick={() => void commitRename()} disabled={!renameName.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <MoveToWorkspaceDialog
        ids={Array.from(selected)}
        open={moveOpen}
        onOpenChange={setMoveOpen}
        onMoved={() => setSelected(new Set())}
      />

      <Dialog open={tagOpen} onOpenChange={setTagOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add tags to {selected.size} Documents</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label>Tags</Label>
            <TagPicker id="bulk-tags" value={bulkTags} onChange={(v) => setBulkTags(Array.isArray(v) ? v.map(String) : [])} placeholder="Add tag…" />
          </div>
          <DialogFooter>
            <Button onClick={() => void bulkTag()} disabled={bulkTags.length === 0}>
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
