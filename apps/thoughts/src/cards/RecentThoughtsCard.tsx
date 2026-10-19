import { useMemo } from "react";
import { Link } from "react-router";
import { formatHuman, type CardProps } from "@lifeline/core";
import { useThoughts } from "../data/repo";
import { streamOf } from "../domain/stream";
import { isKind, kindLabel, thoughtHref } from "../domain/types";

/** The newest few Thoughts, one line each, optionally of one kind. */
export function RecentThoughtsCard({ settings }: CardProps) {
  const thoughts = useThoughts();
  const count = Number(settings.count ?? 6);
  const kind = isKind(settings.kind) ? settings.kind : undefined;
  const recent = useMemo(() => streamOf(thoughts, kind).flatMap((d) => d.thoughts).slice(0, count), [thoughts, kind, count]);
  if (recent.length === 0) return <p className="text-muted-foreground p-3 text-sm">No thoughts yet.</p>;
  return (
    <ul className="grid gap-1 p-2">
      {recent.map((t) => (
        <li key={t.id} className="min-w-0">
          <Link to={thoughtHref(t.id)} className="hover:bg-accent flex min-w-0 items-center gap-2 rounded px-2 py-1 text-sm">
            <span className="min-w-0 flex-1 truncate">{t.title}</span>
            <span className="text-muted-foreground shrink-0 text-xs">{kindLabel(t.kind) ?? formatHuman(t.createdAt)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
