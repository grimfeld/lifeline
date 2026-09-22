import { useMemo, useState, type ReactNode } from "react";
import { Checkbox, cn } from "@lifeline/ui";
import type { Aisle, Need } from "../domain/types";
import { BOUGHT_RECENTLY_DAYS, boughtRecently, groupByAisle, isListed } from "../domain/rules";
import { markBought, recentSince, unmarkBought } from "../data/repo";

function NeedRow({ need, onOpen, onTick }: { need: Need; onOpen?: (n: Need) => void; onTick: (n: Need, bought: boolean) => void }) {
  const bought = !isListed(need);
  return (
    <li className="flex items-center gap-2 rounded-md px-1 py-1">
      <Checkbox checked={bought} onCheckedChange={(c) => onTick(need, c === true)} aria-label={bought ? `Put ${need.title} back` : `Bought ${need.title}`} />
      <button type="button" className={cn("min-w-0 flex-1 truncate text-left text-sm", bought && "text-muted-foreground line-through", onOpen && "hover:underline")} onClick={() => onOpen?.(need)}>
        {need.title}
        {need.note ? <span className="text-muted-foreground ml-2 text-xs">{need.note}</span> : null}
      </button>
    </li>
  );
}

/**
 * The list as read in the shop (ADR 0055): Anywhere first, then each Aisle
 * in my order. A tick greys the Need in place until the list is left, so a
 * fat finger is seen and undone with one tap; then it moves to the
 * "Bought recently" strip below.
 */
export function NeedList({
  needs,
  aisles,
  onOpen,
  aisleHeader,
  showEmptyAisles = false,
  showRecent = true,
}: {
  needs: Need[];
  aisles: Aisle[];
  onOpen?: (n: Need) => void;
  /** Extra controls beside an Aisle's heading (the screen's reorder and edit). */
  aisleHeader?: (aisle: Aisle) => ReactNode;
  showEmptyAisles?: boolean;
  showRecent?: boolean;
}) {
  // Ticked while this list is open: still shown where they were, struck through.
  const [ticked, setTicked] = useState<Set<string>>(() => new Set());
  const shown = useMemo(() => needs.filter((n) => isListed(n) || ticked.has(n.id)), [needs, ticked]);
  const groups = groupByAisle(shown, aisles).filter((g) => g.needs.length > 0 || (showEmptyAisles && g.aisle));
  const recent = useMemo(() => boughtRecently(needs, recentSince(BOUGHT_RECENTLY_DAYS)).filter((n) => !ticked.has(n.id)), [needs, ticked]);

  function tick(n: Need, bought: boolean) {
    setTicked((s) => new Set(s).add(n.id));
    void (bought ? markBought(n.id) : unmarkBought(n.id));
  }

  const nothing = shown.length === 0;
  return (
    <div className="grid content-start gap-4">
      {nothing && <div className="text-muted-foreground px-1 text-sm">Nothing to buy.</div>}
      {groups.map((g) => (
        <section key={g.aisle?.id ?? "anywhere"}>
          {(g.aisle || groups.length > 1) && (
            <div className="mb-0.5 flex items-center gap-2">
              <h2 className="text-sm font-semibold">{g.aisle?.title ?? "Anywhere"}</h2>
              <span className="text-muted-foreground text-xs">{g.needs.filter(isListed).length}</span>
              {g.aisle && aisleHeader?.(g.aisle)}
            </div>
          )}
          {g.needs.length > 0 ? (
            <ul className="grid gap-0.5">
              {g.needs.map((n) => (
                <NeedRow key={n.id} need={n} onOpen={onOpen} onTick={tick} />
              ))}
            </ul>
          ) : (
            <div className="text-muted-foreground px-1 text-xs">Nothing here.</div>
          )}
        </section>
      ))}
      {showRecent && recent.length > 0 && (
        <details className="text-sm">
          <summary className="text-muted-foreground cursor-pointer text-xs">Bought recently · {recent.length}</summary>
          <ul className="mt-1 grid gap-0.5">
            {recent.map((n) => (
              <NeedRow key={n.id} need={n} onOpen={onOpen} onTick={tick} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
