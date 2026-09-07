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
  DropdownMenuTrigger,
  Input,
  Label,
  cn,
  toast,
} from "@lifeline/ui";
import {
  ALL_VIEW_ID,
  appById,
  applyView,
  availableLayouts,
  COMMON_COLUMNS,
  defaultColumns,
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
  type DocumentTypeDef,
  type ViewFilter,
  type ViewLayout,
  type ViewRecord,
  singularOf,
} from "@lifeline/core";
import { CalendarDays, ChevronDown, Columns3, Images, LayoutGrid, List, MapPin, MoreHorizontal, Plus, Save, Search, Settings2, SquareKanban, Table2, Tag, Trash2 , FolderInput } from "lucide-react";
import { LayoutView } from "./LayoutView";
import { FilterBar } from "./FilterBar";
import { NewDocumentDialog } from "../vault/NewDocumentDialog";
import { TagPicker } from "../components/TagPicker";
import { MoveToWorkspaceDialog } from "../components/MoveToWorkspace";

interface ViewState {
  filters: ViewFilter[];
  search: string;
  sortBy: string;
  sortDir: "asc" | "desc";
  columns: string[];
  layout: ViewLayout;
  /** Field picks for layouts that read one (ADR 0020). */
  imageField?: string;
  geoField?: string;
  groupField?: string;
  dateField?: string;
}

function stateOf(v: ViewRecord | undefined, def: DocumentTypeDef | undefined): ViewState {
  return {
    filters: v?.filters ?? [],
    search: v?.search ?? "",
    sortBy: v?.sortBy ?? "updatedAt",
    sortDir: v?.sortDir ?? "desc",
    columns: v?.columns ?? defaultColumns(def),
    layout: v?.layout ?? "table",
    imageField: v?.imageField,
    geoField: v?.geoField,
    groupField: v?.groupField,
    dateField: v?.dateField,
  };
}

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
  async function removeView() {
    if (!view) return;
    await deleteView(view.id);
    selectView(ALL_VIEW_ID);
  }
  function toggleSort(key: string) {
    setState((s) => (s.sortBy === key ? { ...s, sortDir: s.sortDir === "asc" ? "desc" : "asc" } : { ...s, sortBy: key, sortDir: "asc" }));
  }
  function toggleColumn(key: string) {
    setState((s) => ({ ...s, columns: s.columns.includes(key) ? s.columns.filter((c) => c !== key) : [...s.columns, key] }));
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
    for (const id of ids) await removeDocument(id);
    setSelected(new Set());
    toast.success(`${ids.length} deleted`);
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
        <h1 className="text-lg font-semibold tracking-tight">{def.label}</h1>
        <Badge variant="secondary">{docs.length}</Badge>
        {def.internal && <Badge variant="outline">internal</Badge>}
        {app && (
          <Badge variant="outline" className="gap-1" title={`Owned by the ${app.title} App`}>
            {app.title}
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-1">
          {creatable && (
            <Button size="sm" onClick={() => setNewOpen(true)}>
              <Plus /> New {singularOf(def).toLowerCase()}
            </Button>
          )}
          {app && def.href && (
            <Button size="sm" variant="outline" onClick={() => navigate(def.href!({ id: "", type, title: "", tags: [], folder: "", createdAt: "", updatedAt: "", deleted: 0 }))}>
              Open in {app.title}
            </Button>
          )}
          <Button size="icon" variant="ghost" className="size-8" title="Document types" onClick={() => navigate("/base")}>
            <Settings2 />
          </Button>
        </div>
      </header>

      {/* Views */}
      <div className="flex flex-wrap items-center gap-1 border-b px-4 py-1.5">
        <button className={cn("rounded-md px-2 py-1 text-sm", viewId === ALL_VIEW_ID ? "bg-accent font-medium" : "hover:bg-accent/50")} onClick={() => selectView(ALL_VIEW_ID)}>
          All
        </button>
        {views.map((v) => (
          <button key={v.id} className={cn("rounded-md px-2 py-1 text-sm", viewId === v.id ? "bg-accent font-medium" : "hover:bg-accent/50")} onClick={() => selectView(v.id)}>
            {v.name}
          </button>
        ))}
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSaveAsOpen(true)}>
          <Plus className="size-3" /> View
        </Button>
        {dirty && (
          <span className="ml-auto flex items-center gap-1">
            {view && (
              <Button size="sm" variant="outline" className="h-7" onClick={() => void saveCurrent()}>
                <Save /> Save “{view.name}”
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-7" onClick={() => setSaveAsOpen(true)}>
              Save as…
            </Button>
            <Button size="sm" variant="ghost" className="h-7" onClick={() => setState(stateOf(view, def))}>
              Reset
            </Button>
          </span>
        )}
        {view && !dirty && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="ml-auto size-7">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  const name = window.prompt("Rename view", view.name);
                  if (name?.trim()) void saveView({ ...view, name: name.trim() });
                }}
              >
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => void removeView()}>
                <Trash2 /> Delete view
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-1.5">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2" />
          <Input className="h-7 w-48 pl-7 text-xs" placeholder="Search…" value={state.search} onChange={(e) => setState({ ...state, search: e.target.value })} />
        </div>
        <FilterBar def={def} filters={state.filters} onChange={(filters) => setState({ ...state, filters })} />
        <div className="ml-auto flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 text-xs">
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
              <Button size="sm" variant="ghost" className="h-7 text-xs" title="Columns">
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
                <Button size="sm" variant="ghost" className="h-7 text-xs" title={`Field the ${LAYOUT_META[state.layout].label} layout reads`}>
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
          <div className="bg-muted/60 flex rounded-md p-0.5">
            {layouts.map((id) => {
              const l = LAYOUT_META[id];
              return (
                <button key={id} title={l.label} className={cn("rounded px-1.5 py-0.5", state.layout === id ? "bg-background shadow-sm" : "text-muted-foreground")} onClick={() => setState({ ...state, layout: id })}>
                  <l.icon className="size-3.5" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="bg-accent/40 flex items-center gap-2 border-b px-4 py-1.5 text-sm">
          <span>{selected.size} selected</span>
          <Button size="sm" variant="outline" className="h-7" onClick={() => setTagOpen(true)}>
            <Tag /> Add tags
          </Button>
          <Button size="sm" variant="outline" className="h-7" onClick={() => setMoveOpen(true)}>
            <FolderInput /> Move to workspace
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-destructive" onClick={() => void bulkDelete()}>
            <Trash2 /> Delete
          </Button>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => setSelected(new Set(rows.map((r) => r.id)))}>
            Select all {rows.length}
          </Button>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      <div className={cn("min-h-0 flex-1", ["map", "board", "calendar"].includes(state.layout) ? "overflow-hidden" : "overflow-y-auto")}>
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
