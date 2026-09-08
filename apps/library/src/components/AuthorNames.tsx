import { Fragment } from "react";
import { Link } from "react-router";
import { cn } from "@lifeline/ui";
import { authorNamesOf, byline } from "../domain/authors";
import type { Work } from "../domain/types";
import { useAuthorIndex } from "../data/repo";
import { authorHref } from "../constants";

/** A resolver from a Work to its Authors' names, for search and tooltips. */
export function useAuthorNames(): (w: Pick<Work, "authors">) => string[] {
  const index = useAuthorIndex();
  return (w) => authorNamesOf(w, index);
}

/** The byline as plain text ("Frank Herbert, Brian Herbert"). */
export function useByline(w: Pick<Work, "authors">): string {
  return byline(useAuthorNames()(w));
}

/**
 * The byline of a Work: its Authors' names, each a link to the Author's
 * page in the Library (ADR 0052) unless `plain`. Renders nothing for none.
 */
export function AuthorNames({ item, plain, className, stop }: { item: Pick<Work, "authors">; plain?: boolean; className?: string; stop?: boolean }) {
  const index = useAuthorIndex();
  const ids = (item.authors ?? []).filter((id) => index.has(id));
  if (ids.length === 0) return null;
  if (plain) return <span className={className}>{byline(ids.map((id) => index.get(id)!.title))}</span>;
  return (
    <span className={cn("min-w-0", className)}>
      {ids.map((id, i) => (
        <Fragment key={id}>
          {i > 0 && ", "}
          <Link to={authorHref(id)} className="underline-offset-2 hover:underline" onClick={(e) => stop && e.stopPropagation()}>
            {index.get(id)!.title}
          </Link>
        </Fragment>
      ))}
    </span>
  );
}
