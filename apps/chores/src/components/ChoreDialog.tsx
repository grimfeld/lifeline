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
  toast,
} from "@lifeline/ui";
import {
  displayTitle,
  docHref,
  documentType,
  initialList,
  initialText,
  normalizeTag,
  todayStr,
  useBacklinks,
  useLinkIndex,
  useTagVocabulary,
} from "@lifeline/core";
import type { Chore } from "../domain/types";
import { draftOf, scheduleOf } from "../domain/scheduleDraft";
import { addChore, updateChore } from "../data/repo";
import { ScheduleFields } from "./ScheduleFields";

/** Documents mentioning this chore via [[wikilink]] (ADR 0018). Muted, read-only. */
function MentionedIn({ choreId }: { choreId: string }) {
  const links = useBacklinks(choreId);
  const idx = useLinkIndex();
  if (links.length === 0) return null;
  return (
    <div className="grid gap-1 text-xs text-muted-foreground">
      <span>
        Mentioned in {links.length} {links.length === 1 ? "document" : "documents"}
      </span>
      <ul className="grid gap-0.5">
        {links.map((l) => {
          const src = idx.byId.get(l.sourceId);
          const title = src ? displayTitle(src, documentType(src.type)) : l.sourceId;
          return (
            <li key={`${l.sourceId}/${l.field ?? ""}`}>
              {src ? (
                <a href={docHref(src)} className="underline-offset-2 hover:underline">
                  {title}
                </a>
              ) : (
                title
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ChoreDialog({
  open,
  onOpenChange,
  chore,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present = edit mode. */
  chore?: Chore;
  /** Create mode, the palette's inline line (CommandDialogProps.initial): the name and Tags it understood. */
  initial?: Record<string, unknown>;
}) {
  const [name, setName] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const suggestions = useTagVocabulary().map((v) => v.tag);
  const [draft, setDraft] = useState(() => draftOf(undefined));

  useEffect(() => {
    if (!open) return;
    setName(chore?.title ?? initialText(initial, "title"));
    setTags(chore?.tags ?? initialList(initial, "tags"));
    setDraft(draftOf(chore?.schedule));
  }, [open, chore, initial]);

  async function submit() {
    const read = scheduleOf(draft);
    if (!name.trim() || !read.ok) {
      toast.error(!name.trim() ? "Name required" : read.ok ? "" : read.error);
      return;
    }
    const schedule = read.schedule;
    if (chore) {
      await updateChore({ ...chore, title: name.trim(), tags, schedule });
      toast.success("Chore updated");
    } else {
      await addChore({
        title: name.trim(),
        tags,
        schedule,
        anchorDate: schedule.kind === "interval" ? todayStr() : null,
      });
      toast.success("Chore added");
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{chore ? "Edit chore" : "New chore"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="chore-name">Name</Label>
            <Input
              id="chore-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Water the plants"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="chore-tags">Tags</Label>
            <TagInput
              id="chore-tags"
              value={tags}
              onChange={setTags}
              suggestions={suggestions}
              normalize={normalizeTag}
              placeholder="kitchen, garden…"
            />
          </div>
          <ScheduleFields value={draft} onChange={setDraft} idPrefix="chore-" />
          {chore && <MentionedIn choreId={chore.id} />}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()}>{chore ? "Save" : "Add chore"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
