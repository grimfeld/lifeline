import { Badge } from "@lifeline/ui";
import { whenOf, type UpcomingOccasion } from "../domain/occasions";

/** A Person's next Occasion as a badge: "Birthday in 3 days", with their age ("turns 40", or just "40" when bare). */
export function NextOccasionBadge({ next, variant, bareAge }: { next: Pick<UpcomingOccasion, "label" | "inDays" | "age">; variant: "default" | "secondary"; bareAge?: boolean }) {
  return (
    <Badge variant={variant}>
      {next.label} {whenOf(next.inDays)}
      {next.age !== null && ` · ${bareAge ? next.age : `turns ${next.age}`}`}
    </Badge>
  );
}

/** A Person's Tags as badges, each cut to the row's width. */
export function TagBadges({ tags, variant }: { tags: readonly string[]; variant: "secondary" | "outline" }) {
  return tags.map((t) => (
    <Badge key={t} variant={variant} className="max-w-full">
      <span className="min-w-0 truncate">#{t}</span>
    </Badge>
  ));
}
