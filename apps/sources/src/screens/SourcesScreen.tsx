import { useState } from "react";
import { useNavigate } from "react-router";
import {
  Button,
  Card,
  CardContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  PhoneDock,
  TagChips,
  toast,
} from "@lifeline/ui";
import { CalendarDays, Gauge, Globe, MoreHorizontal, Pencil, Plus, RefreshCw, Rss, Trash2 } from "lucide-react";
import { colorVar, type Source, type SourceKind } from "../domain/types";
import { hostOf } from "../domain/url";
import { deleteSource, useSources } from "../data/repo";
import { SourceDialog, KIND_LABEL } from "../components/SourceDialog";
import { OpenExternalButton } from "../components/OpenExternalButton";
import { sourceHref } from "../hrefs";

export const KIND_ICON: Record<SourceKind, typeof Globe> = { embed: Globe, feed: Rss, ical: CalendarDays, value: Gauge };
const KIND_ORDER: SourceKind[] = ["embed", "feed", "ical", "value"];
const KIND_TITLE: Record<SourceKind, string> = { embed: "Embeds", feed: "Feeds", ical: "Calendar subscriptions", value: "Live values" };

function SourceRow({ source, onEdit }: { source: Source; onEdit: (s: Source) => void }) {
  const navigate = useNavigate();
  const Icon = KIND_ICON[source.kind];
  return (
    <Card className="py-3">
      <CardContent className="flex items-center gap-3 px-4">
        {source.kind === "ical" ? (
          <span className="size-3 shrink-0 rounded-full" style={{ background: colorVar(source.color) }} />
        ) : (
          <Icon className="text-muted-foreground size-4 shrink-0" />
        )}
        <button className="min-w-0 flex-1 text-left" onClick={() => navigate(sourceHref(source.id))}>
          <div className="truncate font-medium">{source.title}</div>
          <div className="text-muted-foreground flex items-center gap-1.5 truncate text-xs">
            <span className="truncate">{hostOf(source.url)}</span>
            {source.refreshMinutes && (
              <span className="flex shrink-0 items-center gap-0.5">
                <RefreshCw className="size-3" /> {source.refreshMinutes} min
              </span>
            )}
            {source.kind === "value" && <span className="shrink-0 font-mono">{source.mode === "json" ? source.path || "$" : "/regex/"}</span>}
            <TagChips tags={source.tags} size="xs" className="shrink-0" />
          </div>
        </button>
        <OpenExternalButton url={source.url} iconOnly className="size-8" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="size-8">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(source)}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                void deleteSource(source.id);
                toast.success(`${KIND_LABEL[source.kind]} deleted`);
              }}
            >
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  );
}

/** The Sources App's management screen: every Source by kind, add/edit/delete. */
export function SourcesScreen() {
  const sources = useSources();
  const [dialog, setDialog] = useState<{ kind: SourceKind; source?: Source } | null>(null);

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold tracking-tight">Sources</h1>
        <span className="text-muted-foreground text-sm">{sources.length} source{sources.length === 1 ? "" : "s"}</span>
        <PhoneDock>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="ml-auto h-8">
                <Plus /> New
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {KIND_ORDER.map((k) => {
                const Icon = KIND_ICON[k];
                return (
                  <DropdownMenuItem key={k} onClick={() => setDialog({ kind: k })}>
                    <Icon /> New {KIND_LABEL[k]}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </PhoneDock>
      </div>
      <div className="grid gap-4 overflow-y-auto">
        {sources.length === 0 && (
          <div className="text-muted-foreground py-10 text-center text-sm">
            Nothing yet. Add an embed (a web page), a feed, a calendar subscription or a live value.
          </div>
        )}
        {KIND_ORDER.map((k) => {
          const list = sources.filter((s) => s.kind === k).sort((a, b) => a.title.localeCompare(b.title));
          if (list.length === 0) return null;
          return (
            <section key={k} className="grid gap-2">
              <h2 className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{KIND_TITLE[k]}</h2>
              {list.map((s) => (
                <SourceRow key={s.id} source={s} onEdit={(src) => setDialog({ kind: src.kind, source: src })} />
              ))}
            </section>
          );
        })}
      </div>
      {dialog && <SourceDialog open onOpenChange={(o) => !o && setDialog(null)} kind={dialog.kind} source={dialog.source} />}
    </div>
  );
}
