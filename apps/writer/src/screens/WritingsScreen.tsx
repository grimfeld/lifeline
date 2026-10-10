import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Badge, Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, PhoneDock, cn, toast } from "@lifeline/ui";
import { basePath, excerpt, formatHuman } from "@lifeline/core";
import { Feather, Plus, Table2 } from "lucide-react";
import { newWriting, useWritings } from "../data";
import { groupOf, STATUSES, WRITING, wordCount, writingHref, type WritingStatus } from "../types";

/**
 * The Writer's desk: writings grouped by status, newest edit first; New writing.
 * Below `md` the status strip and the actions sit in the phone dock and a
 * row is one tap target — see ADR 0021.
 */
export function WritingsScreen() {
  const writings = useWritings();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [group, setGroup] = useState("");
  const [status, setStatus] = useState<WritingStatus | "all">("all");
  const rows = useMemo(
    () => [...writings].filter((w) => status === "all" || (w.status || "draft") === status).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [writings, status],
  );
  async function create() {
    if (!title.trim()) return;
    try {
      const w = await newWriting({ title, group });
      setOpen(false);
      setTitle("");
      setGroup("");
      navigate(writingHref(w.id));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="grid gap-2 border-b px-3 py-2 md:flex md:items-center md:px-4">
        <div className="flex items-center gap-2">
          <Feather className="text-muted-foreground size-5 shrink-0" />
          <h1 className="text-lg font-semibold tracking-tight">Writings</h1>
          <Badge variant="secondary">{writings.length}</Badge>
        </div>
        <PhoneDock row order={1}>
          <div className="flex gap-0.5 md:ml-4">
            {(["all", ...STATUSES.map((s) => s.value)] as const).map((s) => (
              <button key={s} className={cn("shrink-0 rounded-md px-2 py-1 text-xs md:py-0.5", status === s ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/50")} onClick={() => setStatus(s)}>
                {s === "all" ? "All" : STATUSES.find((x) => x.value === s)?.label}
              </button>
            ))}
          </div>
        </PhoneDock>
        <PhoneDock row className="justify-end">
          <div className="ml-auto flex items-center gap-1">
            <Button size="sm" variant="ghost" asChild>
              <Link to={basePath(WRITING)}>
                <Table2 /> Base
              </Link>
            </Button>
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus /> New writing
            </Button>
          </div>
        </PhoneDock>
      </header>
      <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
        {rows.length === 0 && <li className="text-muted-foreground px-4 py-8 text-center text-sm">Nothing here yet. Start a new writing.</li>}
        {rows.map((w) => (
          <li key={w.id}>
            {/* The whole row is the link: a phone has no hover, and a title is a small target. */}
            <Link to={writingHref(w.id)} className="hover:bg-accent/40 block px-3 py-3 md:px-4 md:py-2">
              <div className="font-medium">{w.title}</div>
              <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline" className="text-[10px]">
                  {STATUSES.find((s) => s.value === (w.status || "draft"))?.label}
                </Badge>
                {groupOf(w) && <span>{groupOf(w)}</span>}
                <span>{wordCount(w.body)} words</span>
                <span>edited {formatHuman(w.updatedAt.slice(0, 10) || w.createdAt)}</span>
              </div>
              <p className="text-muted-foreground mt-0.5 line-clamp-2 text-sm">{excerpt(w.body, 200)}</p>
            </Link>
          </li>
        ))}
      </ul>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New writing</DialogTitle>
          </DialogHeader>
          <Input autoFocus placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void create()} />
          <Input placeholder="Folder (optional) — e.g. Talks" value={group} onChange={(e) => setGroup(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void create()} />
          <DialogFooter>
            <Button onClick={() => void create()} disabled={!title.trim()}>
              Start writing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
