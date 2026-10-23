import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Badge, Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, toast } from "@lifeline/ui";
import { BookOpenText, Plus } from "lucide-react";
import { newManuscript, useAllChapters, useManuscripts } from "../data/repo";
import { wordCount } from "../domain/order";
import { FORMS, STATUSES, manuscriptHref } from "../domain/types";

/**
 * The Manuscript Module's shelf (ADR 0068): every work in progress or done,
 * as a spine with its form, its Chapters and its length.
 */
export function ShelfScreen() {
  const manuscripts = useManuscripts();
  const chapters = useAllChapters();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [form, setForm] = useState("novel");
  const stats = useMemo(() => {
    const m = new Map<string, { chapters: number; words: number }>();
    for (const c of chapters) {
      const s = m.get(c.manuscriptId) ?? { chapters: 0, words: 0 };
      s.chapters += 1;
      s.words += wordCount(c.body ?? "");
      m.set(c.manuscriptId, s);
    }
    return m;
  }, [chapters]);
  const sorted = useMemo(() => [...manuscripts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [manuscripts]);

  async function create() {
    try {
      const m = await newManuscript({ title, form });
      setOpen(false);
      setTitle("");
      navigate(manuscriptHref(m.id));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-5 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Manuscripts</h1>
        <Button size="sm" className="ml-auto" onClick={() => setOpen(true)}>
          <Plus /> New manuscript
        </Button>
      </div>
      {sorted.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">No manuscripts yet. A novel, a collection of poems — start one and write it chapter by chapter.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-3">
          {sorted.map((m) => {
            const s = stats.get(m.id) ?? { chapters: 0, words: 0 };
            return (
              <Link key={m.id} to={manuscriptHref(m.id)} className="bg-card hover:bg-accent/40 grid min-h-44 min-w-0 content-between gap-3 rounded-lg border p-4 transition-colors">
                <div className="grid min-w-0 gap-1">
                  <BookOpenText className="text-muted-foreground size-5" />
                  <span className="line-clamp-3 font-serif text-lg leading-snug [overflow-wrap:anywhere]">{m.title}</span>
                </div>
                <div className="grid gap-1">
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary">{FORMS.find((f) => f.value === m.form)?.label ?? "Work"}</Badge>
                    <Badge variant="outline">{STATUSES.find((x) => x.value === (m.status || "draft"))?.label}</Badge>
                  </div>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {s.chapters} {s.chapters === 1 ? "chapter" : "chapters"} · {s.words.toLocaleString()} words
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New manuscript</DialogTitle>
          </DialogHeader>
          <Input aria-label="Working title" autoFocus placeholder="Working title" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && title.trim() && void create()} />
          <Select value={form} onValueChange={setForm}>
            <SelectTrigger aria-label="Form">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORMS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
