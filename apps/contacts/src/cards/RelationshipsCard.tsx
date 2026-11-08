import { useMemo } from "react";
import { Link } from "react-router";
import type { CardProps } from "@lifeline/core";
import { useDocuments } from "@lifeline/core";
import { personHref } from "../constants";
import { groupByRelationship } from "../domain/drifting";
import { PERSON, type Person } from "../domain/types";
import { normalizePerson } from "../data/repo";

/** Group by Relationship, as a Card (#404): the People under each Relationship I gave them, with a count. */
export function RelationshipsCard(_props: CardProps) {
  const rows = useDocuments<Person>(PERSON);
  const groups = useMemo(() => groupByRelationship(rows.map(normalizePerson)), [rows]);
  if (groups.length === 0) return <p className="text-muted-foreground p-3 text-sm">No one has a Relationship yet.</p>;
  return (
    <ul className="grid min-w-0 content-start gap-3 overflow-auto p-3">
      {groups.map((g) => (
        <li key={g.relationship} className="grid min-w-0 gap-1">
          <div className="flex min-w-0 items-baseline justify-between gap-2">
            <span className="min-w-0 truncate text-sm font-medium">{g.relationship}</span>
            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{g.count}</span>
          </div>
          <p className="text-muted-foreground min-w-0 text-sm">
            {g.people.map((p, i) => (
              <span key={p.id}>
                {i > 0 && ", "}
                <Link to={personHref(p.id)} className="hover:underline">
                  {p.title}
                </Link>
              </span>
            ))}
          </p>
        </li>
      ))}
    </ul>
  );
}
