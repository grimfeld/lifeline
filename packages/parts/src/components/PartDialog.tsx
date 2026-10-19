import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Input, Label } from "@lifeline/ui";
import { Check, Trash2, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { todayStr } from "@lifeline/core";
import {
  averageRating,
  caughtUpOf,
  groupName,
  isCaughtUp,
  isRead,
  partName,
  posOf,
  samePos,
  type Group,
  type Part,
  type PartsMedium,
  type Pos,
} from "../domain";
import type { PartsKit, PartsWork } from "../kit";
import { AverageNote, MarksControls, ReviewEditor } from "./Marks";
import { announceRead, attempt } from "./announce";

/** A title typed by hand, saved on blur or Enter. */
function NameField({ value, onSave, placeholder }: { value: string; onSave: (v: string) => void; placeholder: string }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const save = () => draft.trim() !== value.trim() && onSave(draft.trim());
  return (
    <div className="grid gap-1">
      <Label className="text-muted-foreground text-[11px] tracking-wide uppercase">Title</Label>
      <Input value={draft} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)} onBlur={save} onKeyDown={(e) => e.key === "Enter" && save()} />
    </div>
  );
}

/**
 * One Part (CONTEXT.md): its read day, its Marks and its Review — the work's
 * own detail at a smaller scale. A Part that does not exist yet is written
 * on the first thing said about it, and goes again once it has nothing left.
 */
export function PartDialog<W extends PartsWork>({ kit, work, medium, pos, parts, onClose }: { kit: PartsKit<W>; work: W; medium: PartsMedium; pos: Pos; parts: Part[]; onClose: () => void }) {
  const part = parts.find((p) => samePos(posOf(p), pos));
  const caught = caughtUpOf(work);
  const read = isRead(pos, caught, part);
  const byCatchUp = isCaughtUp(pos, caught, part);
  const name = partName(medium, pos);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="min-w-0 break-words">
            {name}
            {part?.name ? ` · ${part.name}` : ""}
          </DialogTitle>
          <DialogDescription className="min-w-0 break-words">{work.title}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {read ? (
              <>
                <span className="text-sm">
                  {medium.verb}
                  {part?.readOn ? ` on ${part.readOn}` : " before Lifeline"}
                </span>
                {part?.readOn && (
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => void attempt(() => kit.markUnread(work, pos))}>
                    <Undo2 className="size-3" /> Not {medium.verb.toLowerCase()}
                  </Button>
                )}
              </>
            ) : (
              <Button size="sm" onClick={() => void attempt(async () => announceRead(kit, work, medium, await kit.markRead(work, pos)))}>
                <Check /> {medium.verb} today
              </Button>
            )}
            {(!read || byCatchUp) && (
              <Input
                type="date"
                aria-label="Read on another day"
                className="h-8 w-auto"
                max={todayStr()}
                onChange={(e) => e.target.value && void attempt(() => kit.markRead(work, pos, e.target.value))}
              />
            )}
          </div>
          <MarksControls liked={part?.liked ?? false} rating={part?.rating ?? 0} onChange={(p) => void attempt(() => kit.patchPart(work, pos, p))} />
          <NameField value={part?.name ?? ""} placeholder={`What ${name} is called`} onSave={(v) => void attempt(() => kit.patchPart(work, pos, { name: v }))} />
          <ReviewEditor body={part?.body ?? ""} onSave={(body) => attempt(() => kit.patchPart(work, pos, { body }))} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * One Group: how it is declared (a restarting one by its size, a running-on
 * one by its first Part), its Marks and its Review. The average of its
 * Parts' Ratings is shown beside its own, never stored.
 */
export function GroupDialog<W extends PartsWork>({
  kit,
  work,
  medium,
  number,
  create = false,
  groups,
  parts,
  onClose,
}: {
  kit: PartsKit<W>;
  work: W;
  medium: PartsMedium;
  /** The Group's number (the suggested one when creating). */
  number: number;
  /** Declaring a new Group rather than opening one. */
  create?: boolean;
  groups: Group[];
  parts: Part[];
  onClose: () => void;
}) {
  const group = create ? undefined : groups.find((g) => g.number === number);
  const restart = medium.numbering === "restart";
  const [num, setNum] = useState(String(number));
  const [extent, setExtent] = useState(String((restart ? group?.size : group?.firstPart) || ""));
  useEffect(() => setExtent(String((restart ? group?.size : group?.firstPart) || "")), [group?.size, group?.firstPart, restart]);
  const mine = restart ? parts.filter((p) => p.group === number) : [];
  const isNew = create || !group;

  async function declare() {
    const n = Number(num);
    const v = Number(extent);
    if (!Number.isInteger(n) || n < 1) throw new Error(`${medium.group}: a whole number from 1`);
    if (extent && (!Number.isInteger(v) || v < 1)) throw new Error(restart ? `How many ${medium.parts}: a whole number` : `First ${medium.part.toLowerCase()}: a whole number`);
    if (!restart && !v) throw new Error(`Say which ${medium.part.toLowerCase()} ${groupName(medium, n)} starts at`);
    if (isNew && groups.some((g) => g.number === n)) throw new Error(`${groupName(medium, n)} already exists`);
    await kit.patchGroup(work, n, restart ? { size: v || 0 } : { firstPart: v });
    if (isNew) onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="min-w-0 break-words">
            {isNew ? `Add a ${medium.group.toLowerCase()}` : groupName(medium, number)}
            {group?.name ? ` · ${group.name}` : ""}
          </DialogTitle>
          <DialogDescription className="min-w-0 break-words">{work.title}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void attempt(declare);
            }}
          >
            {isNew && (
              <div className="grid w-24 gap-1">
                <Label className="text-muted-foreground text-[11px] tracking-wide uppercase">{medium.group}</Label>
                <Input inputMode="numeric" value={num} onChange={(e) => setNum(e.target.value)} />
              </div>
            )}
            <div className="grid w-36 gap-1">
              <Label className="text-muted-foreground text-[11px] tracking-wide uppercase">{restart ? `${medium.parts} in it` : `Starts at ${medium.part.toLowerCase()}`}</Label>
              <Input inputMode="numeric" value={extent} placeholder={restart ? "Not known yet" : ""} onChange={(e) => setExtent(e.target.value)} />
            </div>
            <Button type="submit" size="sm" variant={isNew ? "default" : "outline"}>
              {isNew ? "Add" : "Save"}
            </Button>
          </form>
          {!isNew && group && (
            <>
              <div className="grid gap-1">
                <MarksControls liked={group.liked} rating={group.rating} onChange={(p) => void attempt(() => kit.patchGroup(work, number, p))} />
                <AverageNote average={averageRating(mine)} of={medium.parts} />
              </div>
              <NameField value={group.name} placeholder={`What ${groupName(medium, number)} is called`} onSave={(v) => void attempt(() => kit.patchGroup(work, number, { name: v }))} />
              <ReviewEditor body={group.body ?? ""} onSave={(body) => attempt(() => kit.patchGroup(work, number, { body }))} />
              <div className="flex justify-end border-t pt-3">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() =>
                    void attempt(async () => {
                      await kit.removeGroup(work, number);
                      onClose();
                    })
                  }
                >
                  <Trash2 /> Remove {groupName(medium, number).toLowerCase()}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
