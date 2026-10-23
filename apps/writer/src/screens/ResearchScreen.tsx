import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Badge, Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, PhoneDock, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, TagInput, toast } from "@lifeline/ui";
import { excerpt, formatHuman, normalizeTag, useTagVocabulary } from "@lifeline/core";
import { Feather, Plus } from "lucide-react";
import { newEssay, useEssays } from "../data";
import { STATUSES, essayHref, wordCount, type Essay, type EssayStatus } from "../types";

const NO_TOPIC = "";

/**
 * The Research Module's desk (ADR 0068): Essays by topic. A topic is a Tag —
 * a thesis's chapters are the Essays sharing one — and an Essay with two Tags
 * sits under both. Nothing contains an Essay.
 */
export function ResearchScreen() {
  const essays = useEssays();
  const navigate = useNavigate();
  const vocabulary = useTagVocabulary().map((v) => v.tag);
  const [status, setStatus] = useState<EssayStatus | "all">("all");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const topics = useMemo(() => {
    const kept = essays.filter((e) => status === "all" || (e.status || "draft") === status).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const by = new Map<string, Essay[]>();
    for (const e of kept) for (const t of e.tags.length ? e.tags : [NO_TOPIC]) by.set(t, [...(by.get(t) ?? []), e]);
    return [...by].sort(([a], [b]) => (a === NO_TOPIC ? 1 : b === NO_TOPIC ? -1 : a.localeCompare(b)));
  }, [essays, status]);

  async function create() {
    try {
      const e = await newEssay({ title, tags });
      setOpen(false);
      setTitle("");
      setTags([]);
      navigate(essayHref(e.id));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-5 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Research</h1>
        <span className="text-muted-foreground text-sm tabular-nums max-md:hidden">{essays.length} essays</span>
      </div>
      <PhoneDock>
        <div className="flex items-center gap-2 max-md:contents">
          <Select value={status} onValueChange={(v) => setStatus(v as EssayStatus | "all")}>
            <SelectTrigger className="h-8 w-36" aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Every status</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="md:ml-auto" onClick={() => setOpen(true)}>
            <Plus /> New essay
          </Button>
        </div>
      </PhoneDock>
      {topics.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">No essays yet. An essay is argued from your Notes, Quotes and Thoughts — start one and pin its material as you go.</p>
      ) : (
        topics.map(([topic, list]) => (
          <section key={topic || "none"} className="grid gap-2">
            <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {topic ? `#${topic}` : "No topic"} <span className="tabular-nums opacity-70">{list.length}</span>
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {list.map((e) => (
                <Link key={`${topic}-${e.id}`} to={essayHref(e.id)} className="bg-card hover:bg-accent/40 grid min-w-0 gap-1 rounded-lg border p-3 transition-colors">
                  <div className="flex min-w-0 items-center gap-2">
                    <Feather className="text-muted-foreground size-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{e.title}</span>
                    <Badge variant="secondary" className="shrink-0">
                      {STATUSES.find((s) => s.value === (e.status || "draft"))?.label}
                    </Badge>
                  </div>
                  <span className="text-muted-foreground line-clamp-2 min-w-0 text-xs">{excerpt(e.body ?? "", 160) || "—"}</span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {wordCount(e.body ?? "")} words · {(Array.isArray(e.material) ? e.material.length : 0)} pinned · {formatHuman(e.updatedAt.slice(0, 10) || e.createdAt)}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New essay</DialogTitle>
          </DialogHeader>
          <Input aria-label="Title" autoFocus placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && title.trim() && void create()} />
          <TagInput value={tags} onChange={setTags} suggestions={vocabulary} normalize={normalizeTag} placeholder="Topic tags — a thesis, a series…" />
          <DialogFooter>
            <Button onClick={() => void create()} disabled={!title.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
