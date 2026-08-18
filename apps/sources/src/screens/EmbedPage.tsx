import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Button, TagChips } from "@lifeline/ui";
import { ArrowLeft, Pencil } from "lucide-react";
import { useEmbed } from "../data/repo";
import { hostOf } from "../domain/url";
import { EmbedFrame } from "../components/EmbedFrame";
import { EmbedDialog } from "../components/EmbedDialog";
import { OpenExternalButton } from "../components/OpenExternalButton";
import { SOURCES_HREF } from "../hrefs";

/** Hidden route /app/sources/:id — one Embed at full size. */
export function EmbedPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const embed = useEmbed(id);
  const [editing, setEditing] = useState(false);

  if (!embed) {
    return (
      <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-3 text-sm">
        That embed no longer exists.
        <Button variant="outline" onClick={() => navigate(SOURCES_HREF)}>
          <ArrowLeft /> Sources
        </Button>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <div className="flex items-center gap-2">
        <Button size="icon" variant="ghost" className="size-8" aria-label="Back to sources" onClick={() => navigate(SOURCES_HREF)}>
          <ArrowLeft />
        </Button>
        <h1 className="truncate text-lg font-semibold tracking-tight">{embed.name}</h1>
        <span className="text-muted-foreground truncate text-xs">{hostOf(embed.url)}</span>
        <TagChips tags={embed.tags} size="xs" />
        <div className="ml-auto flex items-center gap-1">
          <Button variant="outline" className="h-8" onClick={() => setEditing(true)}>
            <Pencil /> Edit
          </Button>
          <OpenExternalButton url={embed.url} />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border">
        <EmbedFrame embed={embed} />
      </div>
      <EmbedDialog open={editing} onOpenChange={setEditing} embed={embed} />
    </div>
  );
}
