import { useEffect, useMemo } from "react";
import { CardUnavailable, cn, toast } from "@lifeline/ui";
import { openExternal, type CardOption, type CardProps, type CardSettings, type CardSettingsSchema } from "@lifeline/core";
import { AlertTriangle } from "lucide-react";
import { markFeedSeen, useFeeds } from "../data/repo";
import { ago, useSourceCache } from "../data/cache";
import { hostOf } from "../domain/url";
import { isNewItem, parseFeed, sortFeedItems, type FeedItem } from "../domain/rss";
import type { Feed } from "../domain/types";

function useFeedOptions(): CardOption[] {
  return useFeeds()
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((f) => ({ value: f.id, label: `${f.title} · ${hostOf(f.url)}` }));
}

export const feedCardSettings: CardSettingsSchema = {
  feed: { kind: "entity", label: "Feed", required: true, useOptions: useFeedOptions },
  count: { kind: "number", label: "Items", default: 8, min: 1, max: 50 },
};

export function useFeedCardTitle(settings: CardSettings): string {
  return useFeeds().find((f) => f.id === settings.feed)?.title ?? "";
}

/** Card (ADR 0017): latest items of one Feed; new since "seen up to" are marked; opening the card marks seen. */
export function FeedCard({ settings, configure }: CardProps) {
  const feed = useFeeds().find((f) => f.id === settings.feed);
  if (!feed) return <CardUnavailable message="That feed no longer exists." onConfigure={configure} />;
  return <FeedList feed={feed} count={Number(settings.count) || 8} />;
}

export function FeedList({ feed, count, className }: { feed: Feed; count: number; className?: string }) {
  const entry = useSourceCache(feed);
  const parsed = useMemo(() => {
    if (!entry?.body) return null;
    try {
      return parseFeed(entry.body);
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [entry?.body]);
  const items: FeedItem[] = parsed && "items" in parsed ? sortFeedItems(parsed.items).slice(0, count) : [];
  const newCount = items.filter((i) => isNewItem(i, feed.seenUpTo)).length;

  // Seen up to now once the list has been shown for a moment.
  useEffect(() => {
    if (!items.length || newCount === 0) return;
    const t = setTimeout(() => void markFeedSeen(feed), 4000);
    return () => clearTimeout(t);
  }, [feed, items.length, newCount]);

  if (!entry) return <div className="text-muted-foreground flex h-full items-center justify-center text-xs">Fetching…</div>;
  if (parsed && "error" in parsed) return <Problem text={parsed.error} />;
  if (!entry.ok && !entry.body) return <Problem text={entry.error ?? "Could not fetch"} />;

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto text-sm">
        {items.length === 0 && <li className="text-muted-foreground px-1 py-2 text-xs">No items.</li>}
        {items.map((it) => {
          const fresh = isNewItem(it, feed.seenUpTo);
          return (
            <li key={it.id}>
              <button
                className="hover:bg-accent/60 flex w-full items-start gap-2 rounded-md px-1.5 py-1 text-left"
                onClick={() => it.link && openExternal(it.link).catch((e: Error) => toast.error(e.message))}
                disabled={!it.link}
                title={it.summary}
              >
                <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", fresh ? "bg-primary" : "bg-transparent")} />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2">{it.title}</span>
                  {it.published && <span className="text-muted-foreground block text-[10px]">{ago(it.published)}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="text-muted-foreground flex items-center gap-1 px-1 pt-1 text-[10px]">
        {!entry.ok && <AlertTriangle className="text-destructive size-3" />}
        <span className="truncate">{entry.ok ? `updated ${ago(entry.fetchedAt)}` : `last try failed · ${entry.error ?? ""}`}</span>
      </div>
    </div>
  );
}

function Problem({ text }: { text: string }) {
  return (
    <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-1 px-2 text-center text-xs">
      <AlertTriangle className="text-destructive size-4" />
      <span className="line-clamp-3">{text}</span>
    </div>
  );
}
