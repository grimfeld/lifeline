import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  TagInput,
  Textarea,
  toast,
  Field,
} from "@lifeline/ui";
import { workType } from "../domain/workTypes";
import { type Work } from "../domain/types";
import { patchWork } from "../data/repo";
import { displayTitle, docHref, normalizeTag, useLinkIndex, useTagVocabulary } from "@lifeline/core";

/** Documents mentioning this item via [[wikilink]] (ADR 0018). Muted, read-only. */
function MentionedIn({ itemId }: { itemId: string }) {
  const index = useLinkIndex();
  const links = index.backlinksTo(itemId);
  if (links.length === 0) return null;
  return (
    <div className="text-muted-foreground grid gap-1 text-xs">
      <span>
        Mentioned in {links.length} {links.length === 1 ? "document" : "documents"}
      </span>
      <ul className="grid gap-0.5">
        {links.map((l) => {
          const src = index.byId.get(l.sourceId);
          if (!src) return null;
          return (
            <li key={`${l.sourceId}/${l.field ?? ""}`}>
              <a href={docHref(src)} className="underline-offset-2 hover:underline">
                {displayTitle(src)}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function EditWorkDialog({ item, onClose }: { item: Work | null; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [creator, setCreator] = useState("");
  const [year, setYear] = useState("");
  const [size, setSize] = useState("");
  const [reason, setReason] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const tagSuggestions = useTagVocabulary().map((v) => v.tag);
  useEffect(() => {
    if (!item) return;
    setTitle(item.title);
    setCreator(item.creator);
    setYear(item.year ? String(item.year) : "");
    setSize(item.size ? String(item.size) : "");
    setReason(item.reason);
    setCoverUrl(item.coverUrl);
    setTags(item.tags ?? []);
  }, [item]);
  if (!item) return null;
  const def = workType(item.type);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {def.label.toLowerCase()}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <div className="grid grid-cols-[1fr_5rem_5rem] gap-2">
            <Field label={def.creatorLabel}><Input value={creator} onChange={(e) => setCreator(e.target.value)} /></Field>
            <Field label="Year"><Input type="number" value={year} onChange={(e) => setYear(e.target.value)} /></Field>
            <Field label={def.sizeUnit}><Input type="number" value={size} onChange={(e) => setSize(e.target.value)} /></Field>
          </div>
          <Field label="Cover URL"><Input value={coverUrl} placeholder="https://…" onChange={(e) => setCoverUrl(e.target.value)} /></Field>
          <Field label={<>Reason <span className="text-muted-foreground font-normal">(optional)</span></>}><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <div className="grid gap-2">
            <Label htmlFor="media-edit-tags">Tags</Label>
            <TagInput id="media-edit-tags" value={tags} onChange={setTags} suggestions={tagSuggestions} normalize={normalizeTag} placeholder="Add tag…" />
          </div>
          <MentionedIn itemId={item.id} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!title.trim()) return void toast.error("Title required");
              void patchWork(item, {
                title: title.trim(),
                creator: creator.trim(),
                year: Number(year) || 0,
                size: Number(size) || 0,
                reason: reason.trim(),
                coverUrl: coverUrl.trim(),
                tags,
              });
              toast.success("Saved");
              onClose();
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
