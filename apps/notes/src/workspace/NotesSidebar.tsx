import { useState } from "react";
import { useNavigate } from "react-router";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, cn } from "@lifeline/ui";
import { CalendarDays, FolderTree, Hash, LayoutTemplate, Plus, Search } from "lucide-react";
import { NOTE_TYPES, isTemplatable, type NoteTypeDef, type NoteTypeId } from "../domain/noteTypes";
import { FileTree } from "./FileTree";
import { SearchPane } from "./SearchPane";
import { TagsPane } from "./TagsPane";
import { NewNoteDialog } from "../components/NewNoteDialog";
import { TemplatesDialog } from "../components/TemplatesDialog";
import { createNote } from "../data/repo";
import { noteHref } from "./useOpenNote";

type Tab = "files" | "search" | "tags";

/** The Notes workspace's own sidebar (ADR 0012): Files / Search / Tags, New note, Today. */
export function NotesSidebar() {
  const [tab, setTab] = useState<Tab>("files");
  const [newType, setNewType] = useState<NoteTypeId | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const navigate = useNavigate();
  const tabs: { id: Tab; icon: typeof FolderTree; label: string }[] = [
    { id: "files", icon: FolderTree, label: "Files" },
    { id: "search", icon: Search, label: "Search" },
    { id: "tags", icon: Hash, label: "Tags" },
  ];
  return (
    <>
      <div className="flex items-center gap-1 px-2 pt-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="h-7 flex-1 justify-start">
              <Plus /> New note
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {(NOTE_TYPES as readonly NoteTypeDef[]).filter(isTemplatable).map((t) => {
              const I = t.icon;
              return (
                <DropdownMenuItem key={t.id} onClick={() => (t.titleRule === "date" ? navigate("/notes/journal") : setNewType(t.id as NoteTypeId))}>
                  <I /> {t.label}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setTemplatesOpen(true)}>
              <LayoutTemplate /> Edit templates…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button size="sm" variant="outline" className="h-7" title="Today's journal" onClick={() => navigate("/notes/journal")}>
          <CalendarDays /> Today
        </Button>
      </div>
      <div className="mx-2 mt-2 flex gap-0.5 border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={cn("flex flex-1 items-center justify-center gap-1 border-b-2 py-1 text-xs", tab === t.id ? "border-primary text-foreground" : "text-muted-foreground border-transparent hover:text-foreground")}
            onClick={() => setTab(t.id)}
            title={t.label}
          >
            <t.icon className="size-3.5" /> {t.label}
          </button>
        ))}
      </div>
      {tab === "files" && <FileTree />}
      {tab === "search" && <SearchPane />}
      {tab === "tags" && <TagsPane />}
      <NewNoteDialog
        type={newType}
        onOpenChange={(o) => !o && setNewType(null)}
        onCreate={async (title) => {
          const n = await createNote({ type: newType!, title });
          setNewType(null);
          navigate(noteHref(n));
        }}
      />
      <TemplatesDialog open={templatesOpen} onOpenChange={setTemplatesOpen} />
    </>
  );
}

