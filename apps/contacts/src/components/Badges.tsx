import { Badge } from "@lifeline/ui";
import { whenOf, type UpcomingOccasion } from "../domain/occasions";

/** A Person's next Occasion as a badge: "Birthday in 3 days · turns 40". */
export function NextOccasionBadge({ next, variant }: { next: Pick<UpcomingOccasion, "label" | "inDays" | "age">; variant: "default" | "secondary" }) {
  return (
    <Badge variant={variant}>
      {next.label} {whenOf(next.inDays)}
      {next.age !== null && ` · turns ${next.age}`}
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
