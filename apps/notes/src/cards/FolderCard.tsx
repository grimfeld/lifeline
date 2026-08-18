import { useState } from "react";
import { useNavigate } from "react-router";
import { formatHuman, type CardProps } from "@lifeline/core";
import { Button } from "@lifeline/ui";
import { Plus } from "lucide-react";
import { createNote, useNotes } from "../data/repo";
import { noteType } from "../data/noteTypes";
import { excerpt } from "../domain/markdown";
import { folderName, isWithin } from "../domain/folders";
import { NewNoteDialog } from "../components/NewNoteDialog";
import { noteHref } from "../workspace/useOpenNote";

/** Card: the notes of one folder, newest first (knobs: folder, recursive, count), with a "+" for a new plain note there. */
export function FolderCard({ settings }: CardProps) {
  const folder = String(settings.folder ?? "");
  const recursive = String(settings.recursive ?? "yes") === "yes";
  const count = Number(settings.count ?? 12);
  const notes = useNotes();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const list = notes
    .filter((n) => n.type !== "template" && (recursive ? isWithin(n.folder, folder) : n.folder === folder))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, count);
  return (
    <div className="flex h-full flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground truncate text-xs">{folder || "Root"}</span>
        <Button size="icon" variant="ghost" className="size-6 shrink-0" title="New note here" onClick={() => setCreating(true)}>
          <Plus />
        </Button>
      </div>
      {list.length === 0 ? (
        <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">No notes here yet.</div>
      ) : (
        <ul className="grid min-h-0 flex-1 content-start gap-1 overflow-y-auto">
          {list.map((n) => {
            const I = noteType(n.type).icon;
            return (
              <li key={n.id}>
                <button className="hover:bg-accent flex w-full flex-col gap-0.5 rounded-md px-1 py-0.5 text-left" onClick={() => navigate(noteHref(n))}>
                  <span className="flex items-center gap-2 text-sm">
                    <I className="text-muted-foreground size-3.5 shrink-0" />
                    <span className="truncate">{n.type === "daily" ? formatHuman(n.title) : n.title}</span>
                    {recursive && n.folder !== folder && <span className="text-muted-foreground ml-auto truncate text-xs">{n.folder}</span>}
                  </span>
                  <span className="text-muted-foreground line-clamp-2 text-xs">{excerpt(n.body, 120)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <NewNoteDialog
        type={creating ? "plain" : null}
        folder={folder}
        onOpenChange={setCreating}
        onCreate={async (title) => {
          const n = await createNote({ type: "plain", title, folder });
          setCreating(false);
          navigate(noteHref(n));
        }}
      />
    </div>
  );
}

export const folderTitle = (settings: CardProps["settings"]) => folderName(String(settings.folder ?? "")) || "Folder";
