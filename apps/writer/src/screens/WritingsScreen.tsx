import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Badge, Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, cn, toast } from "@lifeline/ui";
import { basePath, excerpt, formatHuman } from "@lifeline/core";
import { Feather, Plus, Table2 } from "lucide-react";
import { newWriting, useWritings } from "../data";
import { STATUSES, WRITING, wordCount, writingHref, type WritingStatus } from "../types";

/** The Writer's desk: writings grouped by status, newest edit first; New writing. */
export function WritingsScreen() {
  const writings = useWritings();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [project, setProject] = useState("");
  const [status, setStatus] = useState<WritingStatus | "all">("all");
  const rows = useMemo(
    () => [...writings].filter((w) => status === "all" || (w.status || "draft") === status).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [writings, status],
  );
  async function create() {
    if (!title.trim()) return;
    try {
      const w = await newWriting({ title, project });
      setOpen(false);
      setTitle("");
      setProject("");
      navigate(writingHref(w.id));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b px-4 py-2">
        <Feather className="text-muted-foreground size-5" />
        <h1 className="text-lg font-semibold tracking-tight">Writings</h1>
        <Badge variant="secondary">{writings.length}</Badge>
        <div className="ml-4 flex gap-0.5">
          {(["all", ...STATUSES.map((s) => s.value)] as const).map((s) => (
            <button key={s} className={cn("rounded-md px-2 py-0.5 text-xs", status === s ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/50")} onClick={() => setStatus(s)}>
              {s === "all" ? "All" : STATUSES.find((x) => x.value === s)?.label}
            </button>
          ))}
        </div>
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
      </header>
      <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
        {rows.length === 0 && <li className="text-muted-foreground px-4 py-8 text-center text-sm">Nothing here yet. Start a new writing.</li>}
        {rows.map((w) => (
          <li key={w.id} className="px-4 py-2">
            <Link to={writingHref(w.id)} className="font-medium hover:underline">
              {w.title}
            </Link>
            <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline" className="text-[10px]">
                {STATUSES.find((s) => s.value === (w.status || "draft"))?.label}
              </Badge>
              {w.project && <span>{w.project}</span>}
              <span>{wordCount(w.body)} words</span>
              <span>edited {formatHuman(w.updatedAt.slice(0, 10) || w.createdAt)}</span>
            </div>
            <p className="text-muted-foreground mt-0.5 line-clamp-2 text-sm">{excerpt(w.body, 200)}</p>
          </li>
        ))}
      </ul>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New writing</DialogTitle>
          </DialogHeader>
          <Input autoFocus placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void create()} />
          <Input placeholder="Project (optional)" value={project} onChange={(e) => setProject(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void create()} />
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
