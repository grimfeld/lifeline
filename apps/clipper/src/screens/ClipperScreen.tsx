import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Badge, Button, Input, TagChips } from "@lifeline/ui";
import { basePath, docHref, excerpt, formatHuman } from "@lifeline/core";
import { Scissors, Table2 } from "lucide-react";
import { ClipDialog } from "../ClipDialog";
import { capturedDay, useClippings } from "../data";
import { CLIPPING, hostOf } from "../types";

/** The Clipper's App screen in the Vault: a capture button and the recent clippings, newest first. */
export function ClipperScreen() {
  const clippings = useClippings();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const k = q.trim().toLowerCase();
    return [...clippings]
      .sort((a, b) => String(b.capturedAt).localeCompare(String(a.capturedAt)))
      .filter((c) => !k || c.title.toLowerCase().includes(k) || String(c.source).toLowerCase().includes(k) || c.body.toLowerCase().includes(k));
  }, [clippings, q]);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b px-4 py-2">
        <Scissors className="text-muted-foreground size-5" />
        <h1 className="text-lg font-semibold tracking-tight">Clippings</h1>
        <Badge variant="secondary">{clippings.length}</Badge>
        <Input className="ml-4 h-8 w-56" placeholder="Search clippings…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" asChild>
            <Link to={basePath(CLIPPING)}>
              <Table2 /> Base
            </Link>
          </Button>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Scissors /> Clip…
          </Button>
        </div>
      </header>
      <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
        {rows.length === 0 && <li className="text-muted-foreground px-4 py-8 text-center text-sm">Nothing clipped yet. Paste something with “Clip…”.</li>}
        {rows.map((c) => (
          <li key={c.id} className="px-4 py-2">
            <Link to={docHref(c)} className="font-medium hover:underline">
              {c.title}
            </Link>
            <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
              {c.source && (
                <a href={/^https?:/.test(String(c.source)) ? String(c.source) : undefined} target="_blank" rel="noreferrer" className="hover:underline">
                  {hostOf(String(c.source)) || String(c.source)}
                </a>
              )}
              {c.author && <span>{c.author}</span>}
              {capturedDay(String(c.capturedAt)) && <span>captured {formatHuman(capturedDay(String(c.capturedAt))!)}</span>}
              {c.tags.length > 0 && <TagChips tags={c.tags} size="xs" />}
            </div>
            <p className="text-muted-foreground mt-0.5 line-clamp-2 text-sm">{excerpt(c.body, 200)}</p>
          </li>
        ))}
      </ul>
      <ClipDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
