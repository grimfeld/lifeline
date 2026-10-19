import { useMemo } from "react";
import { useDocuments, type Document } from "@lifeline/core";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, toast } from "@lifeline/ui";
import { Brain } from "lucide-react";
import { keepQuote, unkeepQuote } from "../data/quotes";
import { TOPIC_TYPE, type Quote } from "../domain/types";

type Topic = Document & { name?: string; archived?: boolean };

/** The live Topics a Quote may be kept in — the Knowledge App's, read like any Document. */
export function useTopicNames(): { id: string; name: string; archived: boolean }[] {
  const rows = useDocuments<Topic>(TOPIC_TYPE);
  return useMemo(() => rows.map((t) => ({ id: t.id, name: t.name || t.title, archived: !!t.archived })).sort((a, b) => a.name.localeCompare(b.name)), [rows]);
}

/**
 * Keep a Quote (CONTEXT.md "Quote"): pick the Topic it is practised in, the
 * first time; after that it is kept, stopped and kept again in that Topic.
 */
export function KeepMenu({ quote, className }: { quote: Quote; className?: string }) {
  const topics = useTopicNames();
  const own = topics.find((t) => t.id === quote.topic);
  const live = topics.filter((t) => !t.archived);

  async function keep(topicId: string, name: string) {
    try {
      await keepQuote(quote.id, topicId);
      toast.success(`Kept in ${name}`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" className={className} title={quote.kept ? `Kept in ${own?.name ?? "a topic"}` : "Keep — practise recalling it"} aria-label="Keep quote">
          <Brain className={quote.kept ? "text-primary size-3.5" : "size-3.5"} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {quote.kept ? (
          <>
            <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">Kept in {own?.name ?? "a topic"}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void unkeepQuote(quote.id).then(() => toast.success("No longer kept — its recalls stay"))}>Stop keeping</DropdownMenuItem>
          </>
        ) : quote.topic ? (
          <DropdownMenuItem onSelect={() => void keep(quote.topic, own?.name ?? "its topic")}>Keep again in {own?.name ?? "its topic"}</DropdownMenuItem>
        ) : live.length === 0 ? (
          <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">Add a topic in Knowledge first</DropdownMenuLabel>
        ) : (
          <>
            <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">Keep in…</DropdownMenuLabel>
            {live.map((t) => (
              <DropdownMenuItem key={t.id} onSelect={() => void keep(t.id, t.name)}>
                {t.name}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
