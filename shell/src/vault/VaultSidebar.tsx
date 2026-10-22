import { useState } from "react";
import { useNavigate } from "react-router";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, cn } from "@lifeline/ui";
import { CalendarDays, FolderTree, Hash, Plus, Search, Settings2 } from "lucide-react";
import { screensOf, singularOf, VAULT_FRAME } from "@lifeline/core";
import { FileTree } from "./FileTree";
import { SearchPane } from "./SearchPane";
import { TagsPane } from "./TagsPane";
import { NewDocumentDialog } from "./NewDocumentDialog";
import { useCreatableTypes } from "./useVaultDocs";

type Tab = "files" | "search" | "tags";

/**
 * The Vault's own sidebar — Core's raw editor for bodies (ADR 0068): New…,
 * then Files / Search / Tags. Writing has its own places; this is where bodies
 * are moved, fixed and edited in bulk.
 */
export function VaultSidebar() {
  const [tab, setTab] = useState<Tab>("files");
  const [newType, setNewType] = useState<string | null>(null);
  const navigate = useNavigate();
  const types = useCreatableTypes();
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
            <Button size="sm" className="flex-1 justify-start">
              <Plus /> New
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {types.map((t) => {
              const I = t.icon;
              return (
                <DropdownMenuItem key={t.id} onClick={() => (t.titleRule === "date" ? navigate("/app/journal") : setNewType(t.id))}>
                  {I && <I />} {singularOf(t)}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/base")}>
              <Settings2 /> Document types…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {screensOf(VAULT_FRAME)
          .filter((s) => !s.hidden)
          .map((s) => {
            const I = s.icon ?? CalendarDays;
            return (
              <Button key={s.id} size="sm" variant="outline" title={s.title} onClick={() => navigate(`/vault/${s.path}`)}>
                <I /> {s.title}
              </Button>
            );
          })}
      </div>
      <div className="mx-2 mt-2 flex gap-0.5 border-b">
        {tabs.map((t) => (
          <button
            type="button"
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
      <NewDocumentDialog type={newType} onOpenChange={(o) => !o && setNewType(null)} />
    </>
  );
}
