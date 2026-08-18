import { useEffect, useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, TagInput, toast } from "@lifeline/ui";
import { normalizeTag, useTagVocabulary } from "@lifeline/core";
import type { Embed } from "../domain/types";
import { normalizeEmbedUrl } from "../domain/url";
import { addEmbed, updateEmbed } from "../data/repo";

export function EmbedDialog({
  open,
  onOpenChange,
  embed,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present = edit mode. */
  embed?: Embed;
  onSaved?: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [refresh, setRefresh] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const suggestions = useTagVocabulary().map((v) => v.tag);

  useEffect(() => {
    if (!open) return;
    setName(embed?.name ?? "");
    setUrl(embed?.url ?? "");
    setRefresh(embed?.refreshMinutes ? String(embed.refreshMinutes) : "");
    setTags(embed?.tags ?? []);
  }, [open, embed]);

  async function submit() {
    const u = normalizeEmbedUrl(url);
    if (!u) return void toast.error("Enter an http(s) URL");
    const n = name.trim() || hostFallback(u);
    const refreshMinutes = refresh.trim() === "" ? null : Number(refresh);
    if (refreshMinutes !== null && !(refreshMinutes > 0)) return void toast.error("Refresh must be a positive number of minutes");
    const input = { name: n, url: u, tags, refreshMinutes };
    let id: string;
    if (embed) {
      await updateEmbed(embed, input);
      id = embed.id;
      toast.success("Embed updated");
    } else {
      id = await addEmbed(input);
      toast.success("Embed added");
    }
    onOpenChange(false);
    onSaved?.(id);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{embed ? "Edit embed" : "New embed"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="em-url">URL</Label>
            <Input
              id="em-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://grafana.example.com/d/abc"
              autoFocus
              inputMode="url"
              onKeyDown={(e) => e.key === "Enter" && void submit()}
            />
            <p className="text-muted-foreground text-xs">Shown as-is in a frame. Pages that refuse to be framed stay blank — use “Open” for those.</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="em-name">Name</Label>
            <Input id="em-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Grafana · CPU" onKeyDown={(e) => e.key === "Enter" && void submit()} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="em-refresh">Reload every (minutes)</Label>
              <Input id="em-refresh" type="number" min={1} step={1} value={refresh} onChange={(e) => setRefresh(e.target.value)} placeholder="never" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="em-tags">Tags</Label>
              <TagInput id="em-tags" value={tags} onChange={setTags} suggestions={suggestions} normalize={normalizeTag} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => void submit()}>{embed ? "Save" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function hostFallback(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
