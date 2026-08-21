import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { todayStr, type CardProps, type CardSettings } from "@lifeline/core";
import { CardUnavailable } from "@lifeline/ui";
import { dailyPick, hanging, hungArtworks } from "../domain/rules";
import type { Artwork } from "../domain/types";
import { useArtists, useArtworks, useExhibitions, useRooms } from "../data/repo";
import { ArtworkImage } from "../components/ArtworkImage";
import { ArtworkDialog } from "../components/ArtworkDialog";
import { exhibitionHref } from "../constants";

/** Hook for the card's Exhibition knob: the shows currently hanging. */
export function useHangingExhibitionOptions(): { value: string; label: string }[] {
  const shows = useExhibitions();
  return useMemo(() => hanging(shows).map((e) => ({ value: e.id, label: e.title })), [shows]);
}

export function useOnDisplayTitle(settings: CardSettings): string {
  const shows = useExhibitions();
  const chosen = shows.find((e) => e.id === settings.exhibition);
  return chosen ? `On display · ${chosen.title}` : "On display";
}

/**
 * The museum comes to you: one Artwork drawn from the hanging Exhibitions —
 * the same one all day, another tomorrow (ADR 0022). Clicking the placard
 * walks into the Room it hangs in; clicking the work opens its details.
 */
export function OnDisplayCard({ settings, configure }: CardProps) {
  const navigate = useNavigate();
  const shows = useExhibitions();
  const rooms = useRooms();
  const artworks = useArtworks();
  const artists = useArtists();
  const [editing, setEditing] = useState<Artwork | null>(null);

  const chosenId = typeof settings.exhibition === "string" ? settings.exhibition : "";
  const chosen = chosenId ? shows.find((e) => e.id === chosenId) : undefined;
  if (chosenId && !chosen) return <CardUnavailable message="That exhibition is gone." onConfigure={configure} />;
  const pool = hungArtworks(chosen ? (chosen.state === "HANGING" ? [chosen] : []) : hanging(shows), rooms, artworks);
  const pick = dailyPick(pool, todayStr());
  if (!pick) {
    return <div className="text-muted-foreground flex h-full items-center justify-center px-3 text-center text-sm">{chosen && chosen.state !== "HANGING" ? `“${chosen.title}” is not hanging.` : "Nothing is hanging. Curate an exhibition and hang it."}</div>;
  }
  const artist = artists.find((a) => a.id === pick.artwork.artistId);
  return (
    <>
      <div className="flex h-full min-h-0 flex-col gap-2">
        <button type="button" className="min-h-0 flex-1 cursor-zoom-in" title={pick.artwork.title} onClick={() => setEditing(pick.artwork)}>
          <div className="flex h-full items-center justify-center">
            <ArtworkImage artwork={pick.artwork} size="wall" />
          </div>
        </button>
        <button type="button" className="hover:bg-accent/50 shrink-0 rounded-md px-1 py-0.5 text-left" onClick={() => navigate(exhibitionHref(pick.exhibition.id))}>
          <div className="truncate text-sm font-medium italic">{pick.artwork.title}</div>
          <div className="text-muted-foreground truncate text-xs">
            {[artist?.title, pick.artwork.year].filter(Boolean).join(", ")}
          </div>
          <div className="text-muted-foreground truncate text-[10px]">
            {pick.exhibition.title} · {pick.room.title}
          </div>
        </button>
      </div>
      <ArtworkDialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} artwork={editing} />
    </>
  );
}
