import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Button, ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger, cn, toast } from "@lifeline/ui";
import {
  singularOf,
  allFolders,
  buildTree,
  createFolder,
  deleteFolder,
  displayTitle,
  docHref,
  documentType,
  formatHuman,
  joinFolder,
  lockPrivate,
  moveDocument,
  openPrivateDialog,
  parentFolder,
  PRIVATE_FOLDER,
  removeDocument,
  renameDocument,
  renameFolder,
  useExtraFolders,
  usePrivateGate,
  type Document,
  type FolderNode,
} from "@lifeline/core";
import { ChevronDown, ChevronRight, FilePlus, FolderPlus, Pencil, Trash2, FolderInput, Lock, LockOpen } from "lucide-react";
import { FolderPickerDialog, PromptDialog } from "./PromptDialog";
import { useCreatableTypes, useOpenDoc, useVaultDocs } from "./useVaultDocs";
import { NewDocumentDialog } from "./NewDocumentDialog";

type Note = Document;
const OPEN_KEY = "vault:tree:open";
function loadOpen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(OPEN_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

type Action =
  | { kind: "new-folder"; parent: string }
  | { kind: "rename-folder"; path: string }
  | { kind: "move-folder"; path: string }
  | { kind: "new-note"; folder: string; type: string }
  | { kind: "rename-note"; note: Note }
  | { kind: "move-note"; note: Note }
  | null;

/** The Files pane: real folders (ADR 0013) over every Vault Document, drag-drop moves, context menus. */
export function FileTree() {
  const notes = useVaultDocs();
  const extra = useExtraFolders();
  const navigate = useNavigate();
  const open = useOpenDoc(notes);
  const creatableTypes = useCreatableTypes().filter((t) => t.titleRule === "name");
  const gate = usePrivateGate();
  // ADR 0038: once set up, the Private folder is always in the tree — closed and locked, or open like any other.
  const tree = useMemo(() => buildTree(notes, gate.configured ? [...extra, PRIVATE_FOLDER] : extra), [notes, extra, gate.configured]);
  const folders = useMemo(() => allFolders(tree), [tree]);
  const [openSet, setOpenSet] = useState<Set<string>>(loadOpen);
  const [action, setAction] = useState<Action>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(OPEN_KEY, JSON.stringify(Array.from(openSet)));
  }, [openSet]);
  // Reveal the open note's folder chain.
  useEffect(() => {
    if (!open?.folder) return;
    setOpenSet((s) => {
      const next = new Set(s);
      let p = open.folder;
      while (p) {
        next.add(p);
        p = parentFolder(p);
      }
      return next;
    });
  }, [open?.folder]);

  const toggle = (path: string) =>
    setOpenSet((s) => {
      const next = new Set(s);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  async function guarded(fn: () => Promise<void>) {
    try {
      await fn();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function onDrop(targetFolder: string, e: React.DragEvent) {
    e.preventDefault();
    setDragOver(null);
    const noteId = e.dataTransfer.getData("application/x-lifeline-note");
    const folderPath = e.dataTransfer.getData("application/x-lifeline-folder");
    if (noteId) {
      const n = notes.find((x) => x.id === noteId);
      if (n) void guarded(() => moveDocument(n, targetFolder));
    } else if (folderPath && folderPath !== targetFolder) {
      void guarded(() => renameFolder(folderPath, joinFolder(targetFolder, folderPath.split("/").pop()!)));
    }
  }

  const dropProps = (path: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (e.dataTransfer.types.some((t) => t.startsWith("application/x-lifeline"))) {
        e.preventDefault();
        setDragOver(path);
      }
    },
    onDragLeave: () => setDragOver((d) => (d === path ? null : d)),
    onDrop: (e: React.DragEvent) => onDrop(path, e),
  });

  function renderFolder(node: FolderNode<Note>, depth: number) {
    const isPrivate = gate.configured && node.path === PRIVATE_FOLDER;
    if (isPrivate && gate.locked) {
      // Locked: a closed node with a lock; a click asks for the password. No drag, no drop, no menu.
      return (
        <li key={node.path}>
          <button
            className="flex w-full items-center gap-1 rounded-md py-1 pr-1 text-left text-sm hover:bg-accent/60"
            style={{ paddingLeft: depth * 12 + 4 }}
            title="Locked — click to unlock"
            onClick={() => openPrivateDialog("unlock")}
          >
            <Lock className="text-muted-foreground size-3.5 shrink-0" />
            <span className="truncate font-medium">{node.name}</span>
          </button>
        </li>
      );
    }
    const isOpen = openSet.has(node.path);
    const Chevron = isOpen ? ChevronDown : ChevronRight;
    return (
      <li key={node.path}>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              className={cn("group flex items-center gap-1 rounded-md pr-1 text-sm hover:bg-accent/60", dragOver === node.path && "bg-accent ring-1 ring-primary/40")}
              style={{ paddingLeft: depth * 12 + 4 }}
              draggable={!isPrivate}
              onDragStart={(e) => e.dataTransfer.setData("application/x-lifeline-folder", node.path)}
              {...dropProps(node.path)}
            >
              <button className="flex min-w-0 flex-1 items-center gap-1 py-1 text-left" onClick={() => toggle(node.path)}>
                <Chevron className="text-muted-foreground size-3.5 shrink-0" />
                {isPrivate && <LockOpen className="text-muted-foreground size-3 shrink-0" />}
                <span className="truncate font-medium">{node.name}</span>
              </button>
              <span className="hidden items-center group-hover:flex">
                <Button size="icon" variant="ghost" className="size-5" title="New note here" onClick={() => setAction({ kind: "new-note", folder: node.path, type: "note" })}>
                  <FilePlus className="size-3" />
                </Button>
                <Button size="icon" variant="ghost" className="size-5" title="New folder" onClick={() => setAction({ kind: "new-folder", parent: node.path })}>
                  <FolderPlus className="size-3" />
                </Button>
              </span>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            {creatableTypes.map((t) => {
              const TI = t.icon;
              return (
                <ContextMenuItem key={t.id} onClick={() => setAction({ kind: "new-note", folder: node.path, type: t.id })}>
                  {TI && <TI />} New {singularOf(t).toLowerCase()}
                </ContextMenuItem>
              );
            })}
            <ContextMenuItem onClick={() => setAction({ kind: "new-folder", parent: node.path })}>
              <FolderPlus /> New folder
            </ContextMenuItem>
            <ContextMenuSeparator />
            {isPrivate ? (
              <ContextMenuItem onClick={() => void lockPrivate()}>
                <Lock /> Lock
              </ContextMenuItem>
            ) : (
              <>
                <ContextMenuItem onClick={() => setAction({ kind: "rename-folder", path: node.path })}>
                  <Pencil /> Rename
                </ContextMenuItem>
                <ContextMenuItem onClick={() => setAction({ kind: "move-folder", path: node.path })}>
                  <FolderInput /> Move to…
                </ContextMenuItem>
                <ContextMenuItem variant="destructive" onClick={() => void guarded(() => deleteFolder(node.path))}>
                  <Trash2 /> Delete (empty only)
                </ContextMenuItem>
              </>
            )}
          </ContextMenuContent>
        </ContextMenu>
        {isOpen && (
          <ul>
            {node.folders.map((f) => renderFolder(f, depth + 1))}
            {node.notes.map((n) => renderNote(n, depth + 1))}
          </ul>
        )}
      </li>
    );
  }

  function renderNote(n: Note, depth: number) {
    const def = documentType(n.type);
    const I = def?.icon;
    const active = open?.id === n.id;
    return (
      <li key={n.id}>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <button
              className={cn("flex w-full items-center gap-1.5 rounded-md py-1 pr-1 text-left text-sm", active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50")}
              style={{ paddingLeft: depth * 12 + 8 }}
              draggable
              onDragStart={(e) => e.dataTransfer.setData("application/x-lifeline-note", n.id)}
              onClick={() => navigate(docHref(n, def))}
              title={displayTitle(n, def)}
            >
              {I && <I className="text-muted-foreground size-3.5 shrink-0" />}
              <span className="truncate">{n.type === "daily" ? formatHuman(n.title) : displayTitle(n, def)}</span>
              {def && def.body !== "required" && !(def.vault ?? false) && <span className="text-muted-foreground ml-auto shrink-0 text-[9px] uppercase">{singularOf(def)}</span>}
            </button>
          </ContextMenuTrigger>
          <ContextMenuContent>
            {def?.titleRule === "name" && (
              <ContextMenuItem onClick={() => setAction({ kind: "rename-note", note: n })}>
                <Pencil /> Rename
              </ContextMenuItem>
            )}
            <ContextMenuItem onClick={() => setAction({ kind: "move-note", note: n })}>
              <FolderInput /> Move to…
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              variant="destructive"
              onClick={() =>
                void guarded(async () => {
                  await removeDocument(n.id);
                  toast.success(`“${displayTitle(n, def)}” deleted`);
                })
              }
            >
              <Trash2 /> Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </li>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="text-muted-foreground flex items-center justify-between px-2 py-1 text-xs font-medium">
        Files
        <span className="flex items-center">
          <Button size="icon" variant="ghost" className="size-5" title="New note" onClick={() => setAction({ kind: "new-note", folder: "", type: "note" })}>
            <FilePlus className="size-3" />
          </Button>
          <Button size="icon" variant="ghost" className="size-5" title="New folder" onClick={() => setAction({ kind: "new-folder", parent: "" })}>
            <FolderPlus className="size-3" />
          </Button>
        </span>
      </div>
      <ul className={cn("min-h-0 flex-1 overflow-y-auto px-1 pb-4", dragOver === "" && "bg-accent/40")} {...dropProps("")}>
        {tree.folders.map((f) => renderFolder(f, 0))}
        {tree.notes.map((n) => renderNote(n, 0))}
        {tree.folders.length === 0 && tree.notes.length === 0 && <li className="text-muted-foreground px-2 py-4 text-xs">Nothing in the Vault yet.</li>}
      </ul>

      <PromptDialog
        open={action?.kind === "new-folder"}
        title="New folder"
        label="Folder name"
        confirm="Create"
        onOpenChange={(o) => !o && setAction(null)}
        onSubmit={async (name) => {
          const parent = action?.kind === "new-folder" ? action.parent : "";
          const path = joinFolder(parent, name);
          await createFolder(path);
          setOpenSet((s) => new Set(s).add(parent).add(path));
          setAction(null);
        }}
      />
      <PromptDialog
        open={action?.kind === "rename-folder"}
        title="Rename folder"
        initial={action?.kind === "rename-folder" ? action.path.split("/").pop() : ""}
        confirm="Rename"
        onOpenChange={(o) => !o && setAction(null)}
        onSubmit={async (name) => {
          if (action?.kind !== "rename-folder") return;
          await guarded(() => renameFolder(action.path, joinFolder(parentFolder(action.path), name)));
          setAction(null);
        }}
      />
      <FolderPickerDialog
        open={action?.kind === "move-folder" || action?.kind === "move-note"}
        title={action?.kind === "move-note" ? `Move “${action.note.title}” to…` : "Move folder to…"}
        folders={folders.filter((f) => !(action?.kind === "move-folder" && (f === action.path || f.startsWith(action.path + "/"))))}
        initial={action?.kind === "move-note" ? action.note.folder : action?.kind === "move-folder" ? parentFolder(action.path) : ""}
        onOpenChange={(o) => !o && setAction(null)}
        onSubmit={async (folder) => {
          if (action?.kind === "move-note") await guarded(() => moveDocument(action.note, folder));
          else if (action?.kind === "move-folder") await guarded(() => renameFolder(action.path, joinFolder(folder, action.path.split("/").pop()!)));
          setAction(null);
        }}
      />
      <PromptDialog
        open={action?.kind === "rename-note"}
        title="Rename note"
        initial={action?.kind === "rename-note" ? action.note.title : ""}
        confirm="Rename"
        onOpenChange={(o) => !o && setAction(null)}
        onSubmit={async (title) => {
          if (action?.kind !== "rename-note") return;
          await guarded(() => renameDocument(action.note, title));
          setAction(null);
        }}
      />
      <NewDocumentDialog type={action?.kind === "new-note" ? action.type : null} folder={action?.kind === "new-note" ? action.folder : ""} onOpenChange={(o) => !o && setAction(null)} />
    </div>
  );
}
