import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Badge, PhoneDock, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@lifeline/ui";
import { formatHuman, todayStr, useLinkIndex } from "@lifeline/core";
import { MarkdownView } from "@lifeline/editor";
import { ThoughtComposer } from "../components/ThoughtComposer";
import { useThoughts } from "../data/repo";
import { streamOf } from "../domain/stream";
import { THOUGHT_KINDS, isKind, kindLabel, thoughtHref } from "../domain/types";

const ALL = "__all__";

/**
 * The Thoughts Module's one page (ADR 0068): capture at the top, the stream
 * below — newest first, by day — narrowed by kind. A stream, not an inbox:
 * nothing here asks for a Thought to be processed.
 */
export function ThoughtsScreen() {
  const thoughts = useThoughts();
  const index = useLinkIndex();
  const [kind, setKind] = useState<string>(ALL);
  const days = useMemo(() => streamOf(thoughts, isKind(kind) ? kind : undefined), [thoughts, kind]);
  const today = todayStr();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
      <ThoughtComposer autoFocus />
      <PhoneDock>
        <div className="flex items-center gap-2 max-md:contents">
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger className="h-8 w-44" aria-label="Show kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Every kind</SelectItem>
              {THOUGHT_KINDS.map((k) => (
                <SelectItem key={k.value} value={k.value}>
                  {k.label}s
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground text-xs max-md:hidden">
            {thoughts.length} {thoughts.length === 1 ? "thought" : "thoughts"}
          </span>
        </div>
      </PhoneDock>
      {days.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">{thoughts.length === 0 ? "Nothing yet — write the first one above." : "No thoughts of that kind."}</p>
      ) : (
        days.map((day) => (
          <section key={day.date} className="grid gap-2">
            <h2 className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{day.date === today ? "Today" : formatHuman(day.date)}</h2>
            {day.thoughts.map((t) => (
              <Link key={t.id} to={thoughtHref(t.id)} className="bg-card hover:bg-accent/40 grid min-w-0 gap-1 rounded-lg border p-3 transition-colors">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.title}</span>
                  {kindLabel(t.kind) && (
                    <Badge variant="secondary" className="shrink-0">
                      {kindLabel(t.kind)}
                    </Badge>
                  )}
                </div>
                <div className="text-muted-foreground line-clamp-4 min-w-0 text-sm">
                  <MarkdownView body={t.body} index={index} compact origin={t.id} />
                </div>
                {t.tags.length > 0 && <div className="text-muted-foreground min-w-0 text-xs">{t.tags.map((x) => `#${x}`).join(" ")}</div>}
              </Link>
            ))}
          </section>
        ))
      )}
    </div>
  );
}
