import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Button, TagChips } from "@lifeline/ui";
import { addDays, formatHuman, formatTime, todayStr } from "@lifeline/core";
import { ArrowLeft, Pencil, RefreshCw } from "lucide-react";
import { useSource } from "../data/repo";
import { ago, refreshSource, useSourceCache } from "../data/cache";
import { hostOf } from "../domain/url";
import { expandIcal } from "../domain/ical";
import { colorVar, type CalendarSub } from "../domain/types";
import { EmbedFrame } from "../components/EmbedFrame";
import { SourceDialog } from "../components/SourceDialog";
import { OpenExternalButton } from "../components/OpenExternalButton";
import { FeedList } from "../cards/FeedCard";
import { ValueTile } from "../cards/LiveValueCard";
import { SOURCES_HREF } from "../hrefs";

/** Hidden route /app/sources/:id — one Source at full size, whatever its kind. */
export function SourcePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const source = useSource(id);
  const [editing, setEditing] = useState(false);

  if (!source) {
    return (
      <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-3 text-sm">
        That source no longer exists.
        <Button variant="outline" onClick={() => navigate(SOURCES_HREF)}>
          <ArrowLeft /> Windows
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
        {source.kind === "ical" && <span className="size-3 rounded-full" style={{ background: colorVar(source.color) }} />}
        <h1 className="truncate text-lg font-semibold tracking-tight">{source.title}</h1>
        <span className="text-muted-foreground truncate text-xs">{hostOf(source.url)}</span>
        <TagChips tags={source.tags} size="xs" />
        <div className="ml-auto flex items-center gap-1">
          {source.kind !== "embed" && (
            <Button variant="outline" className="h-8" onClick={() => void refreshSource(source)}>
              <RefreshCw /> Refresh
            </Button>
          )}
          <Button variant="outline" className="h-8" onClick={() => setEditing(true)}>
            <Pencil /> Edit
          </Button>
          <OpenExternalButton url={source.url} />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border p-2">
        {source.kind === "embed" && <EmbedFrame embed={source} />}
        {source.kind === "feed" && <FeedList feed={source} count={100} />}
        {source.kind === "value" && <ValueTile value={source} />}
        {source.kind === "ical" && <CalendarSubPreview sub={source} />}
      </div>
      <SourceDialog open={editing} onOpenChange={setEditing} kind={source.kind} source={source} />
    </div>
  );
}

function CalendarSubPreview({ sub }: { sub: CalendarSub }) {
  const entry = useSourceCache(sub);
  const today = todayStr();
  const occ = useMemo(() => {
    if (!entry?.body) return null;
    try {
      return expandIcal(entry.body, today, addDays(today, 30));
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [entry?.body, today]);
  if (!entry) return <div className="text-muted-foreground p-2 text-xs">Fetching…</div>;
  if (occ && "error" in occ) return <div className="text-destructive p-2 text-xs">{occ.error}</div>;
  if (!entry.ok && !entry.body) return <div className="text-destructive p-2 text-xs">{entry.error}</div>;
  const list = occ ?? [];
  return (
    <div className="flex h-full flex-col">
      <div className="text-muted-foreground px-1 pb-1 text-xs">
        Next 30 days · {list.length} occurrence{list.length === 1 ? "" : "s"} · updated {ago(entry.fetchedAt)}
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto text-sm">
        {list.map((o, i) => (
          <li key={`${o.uid}/${o.date}/${i}`} className="flex items-center gap-2 px-1 py-0.5">
            <span className="text-muted-foreground w-24 shrink-0 text-xs">{formatHuman(o.date)}</span>
            <span className="text-muted-foreground w-24 shrink-0 text-xs tabular-nums">{o.start ? `${formatTime(o.start)}–${o.end === "24:00" ? "" : formatTime(o.end)}` : "all day"}</span>
            <span className="truncate">{o.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
