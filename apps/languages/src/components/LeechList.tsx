import { useMemo, useState } from "react";
import { openPeek } from "@lifeline/core";
import { Button, Card, CardContent, Tip } from "@lifeline/ui";
import { Pause, Pencil } from "lucide-react";
import { leeches } from "../domain/leech";
import type { MaterialDoc } from "../domain/material";
import { promptText } from "../domain/report";
import { FACT, SENTENCE, WORD, type Item, type Recall } from "../domain/types";
import { setPaused } from "../data/repo";
import { ItemDialog } from "./ItemDialog";

const OWN = new Set([WORD, SENTENCE, FACT]);

/**
 * A Topic's Leeches (CONTEXT.md "Leech"): the Prompts that keep failing, with
 * a way to pause the material or edit it. Derived on every render from the
 * Recalls; nothing here is stored.
 */
export function LeechList({ items, recalls }: { items: MaterialDoc[]; recalls: Recall[] }) {
  const [editing, setEditing] = useState<MaterialDoc | undefined>();
  const rows = useMemo(() => {
    const byId = new Map(items.map((m) => [m.id, m]));
    return leeches(items, recalls).map((l) => ({ ...l, m: byId.get(l.itemId)!, question: promptText(byId.get(l.itemId)!, l.slot).question }));
  }, [items, recalls]);
  if (!rows.length) return null;

  const edit = (m: MaterialDoc) => (OWN.has(m.type) ? setEditing(m) : openPeek(m.id));
  return (
    <section className="grid gap-1.5">
      <h2 className="text-muted-foreground text-sm font-medium">Leeches</h2>
      <Card className="py-0">
        <CardContent className="grid gap-0.5 px-2 py-2">
          {rows.map((r) => (
            <div key={`${r.itemId}|${r.slot}`} className="flex items-center gap-2 rounded-sm px-1 py-1 text-sm">
              <span className="min-w-0 flex-1 truncate font-medium">{r.question}</span>
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{r.fails} fails</span>
              {OWN.has(r.m.type) && (
                <Tip label={`Pause ${r.question}`}>
                  <Button size="icon-sm" variant="ghost" className="shrink-0" onClick={() => void setPaused(r.itemId, true)}>
                    <Pause />
                  </Button>
                </Tip>
              )}
              <Tip label={`Edit ${r.question}`}>
                <Button size="icon-sm" variant="ghost" className="shrink-0" onClick={() => edit(r.m)}>
                  <Pencil />
                </Button>
              </Tip>
            </div>
          ))}
        </CardContent>
      </Card>
      <ItemDialog item={editing?.doc as Item | undefined} open={!!editing} onOpenChange={(o) => !o && setEditing(undefined)} />
    </section>
  );
}
