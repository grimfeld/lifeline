import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { docHref, documentType, formatHuman, isWithin, useLinkIndex, type CardProps, singularOf } from "@lifeline/core";
import { Button } from "@lifeline/ui";
import { MarkdownView } from "@lifeline/editor";
import { Dices } from "lucide-react";
import { useNotes } from "../data/repo";
import { useTypeOptions } from "../data/options";
import { pickRandom } from "../domain/search";
import { DAILY, TEMPLATE } from "../domain/types";

/** Card: one random note to resurface (knobs: type, folder), with a reroll. */
export function RandomNoteCard({ settings }: CardProps) {
  const type = String(settings.type ?? "");
  const folder = String(settings.folder ?? "");
  const notes = useNotes();
  const index = useLinkIndex();
  const navigate = useNavigate();
  const pool = notes.filter((n) => n.type !== TEMPLATE && (!type || n.type === type) && (!folder || isWithin(n.folder, folder)));
  const [pickId, setPickId] = useState<string>();
  const pick = pool.find((n) => n.id === pickId);
  useEffect(() => {
    if (!pick && pool.length > 0) setPickId(pickRandom(pool)?.id);
  }, [pick, pool]);
  if (!pick) return <div className="text-muted-foreground flex h-full items-center justify-center text-sm">No notes to draw from.</div>;
  const I = documentType(pick.type)?.icon;
  return (
    <div className="flex h-full flex-col gap-1">
      <div className="flex items-center gap-2">
        <button className="hover:bg-accent flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 text-left" onClick={() => navigate(docHref(pick))}>
          {I && <I className="text-muted-foreground size-3.5 shrink-0" />}
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{pick.type === DAILY ? formatHuman(pick.title) : pick.title}</span>
            <span className="text-muted-foreground block truncate text-xs">{pick.folder || "Root"}</span>
          </span>
        </button>
        <Button size="icon" variant="ghost" className="size-6 shrink-0" title="Another one" disabled={pool.length < 2} onClick={() => setPickId(pickRandom(pool, pick.id)?.id)}>
          <Dices />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto text-sm">
        <MarkdownView body={pick.body} index={index} docDate={pick.type === DAILY ? pick.title : null} compact origin={pick.id} />
      </div>
    </div>
  );
}

/** Type knob options ("" = any type). */
export function useRandomTypeOptions() {
  return useTypeOptions({ excludeTemplate: true });
}

export const randomTitle = (settings: CardProps["settings"]) => { const d = settings.type ? documentType(String(settings.type)) : undefined; return d ? `Random ${singularOf(d).toLowerCase()}` : "Random note"; };
