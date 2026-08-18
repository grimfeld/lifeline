import { useState } from "react";
import { useNavigate } from "react-router";
import {
  Button,
  Card,
  CardContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  TagChips,
  toast,
} from "@lifeline/ui";
import { Globe, MoreHorizontal, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import type { Embed } from "../domain/types";
import { hostOf } from "../domain/url";
import { deleteSource, useEmbeds } from "../data/repo";
import { EmbedDialog } from "../components/EmbedDialog";
import { OpenExternalButton } from "../components/OpenExternalButton";
import { embedHref } from "../hrefs";

function EmbedRow({ embed, onEdit }: { embed: Embed; onEdit: (e: Embed) => void }) {
  const navigate = useNavigate();
  return (
    <Card className="py-3">
      <CardContent className="flex items-center gap-3 px-4">
        <Globe className="text-muted-foreground size-4 shrink-0" />
        <button className="min-w-0 flex-1 text-left" onClick={() => navigate(embedHref(embed.id))}>
          <div className="truncate font-medium">{embed.name}</div>
          <div className="text-muted-foreground flex items-center gap-1.5 truncate text-xs">
            <span className="truncate">{hostOf(embed.url)}</span>
            {embed.refreshMinutes && (
              <span className="flex shrink-0 items-center gap-0.5">
                <RefreshCw className="size-3" /> {embed.refreshMinutes} min
              </span>
            )}
            <TagChips tags={embed.tags} size="xs" className="shrink-0" />
          </div>
        </button>
        <OpenExternalButton url={embed.url} iconOnly className="size-8" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="size-8">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(embed)}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                void deleteSource(embed.id);
                toast.success("Embed deleted");
              }}
            >
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  );
}

/** The Sources App's management screen: every Embed, add/edit/delete. */
export function SourcesScreen() {
  const embeds = useEmbeds().slice().sort((a, b) => a.name.localeCompare(b.name));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Embed | undefined>(undefined);

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold tracking-tight">Sources</h1>
        <span className="text-muted-foreground text-sm">{embeds.length} embed{embeds.length === 1 ? "" : "s"}</span>
        <Button
          className="ml-auto h-8"
          onClick={() => {
            setEditing(undefined);
            setDialogOpen(true);
          }}
        >
          <Plus /> New embed
        </Button>
      </div>
      <div className="grid gap-2 overflow-y-auto">
        {embeds.length === 0 && (
          <div className="text-muted-foreground py-10 text-center text-sm">
            No embeds yet. Add a URL to show a web page on your Screens.
          </div>
        )}
        {embeds.map((e) => (
          <EmbedRow
            key={e.id}
            embed={e}
            onEdit={(em) => {
              setEditing(em);
              setDialogOpen(true);
            }}
          />
        ))}
      </div>
      <EmbedDialog open={dialogOpen} onOpenChange={setDialogOpen} embed={editing} />
    </div>
  );
}
