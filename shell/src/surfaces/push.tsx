import { createContext, useContext, type ReactNode } from "react";
import { Button, Tip, cn, usePushFlow } from "@lifeline/ui";
import { CalendarClock } from "lucide-react";
import { canPush, pushSurfaceItem, type SchedulableItem } from "@lifeline/core";

type Pushable = Pick<SchedulableItem, "appId" | "itemId" | "title" | "date" | "estimateMin" | "completedOn">;

const PushContext = createContext<((item: Pushable) => void) | null>(null);

/**
 * One Push flow for every time surface (ADR 0054): the "how long?" prompt
 * is rendered once here, and any chip asks for it through `usePush`.
 */
export function PushProvider({ children }: { children: ReactNode }) {
  const flow = usePushFlow();
  const push = (item: Pushable) =>
    flow.push({ title: item.title, estimateMin: item.estimateMin, run: (min) => pushSurfaceItem(item, min) });
  return (
    <PushContext.Provider value={push}>
      {children}
      {flow.dialog}
    </PushContext.Provider>
  );
}

/**
 * Push for one surface item, or undefined where Push is not offered: an App
 * that takes no Estimate, or an item already done.
 */
export function usePush(item: Pushable): (() => void) | undefined {
  const push = useContext(PushContext);
  if (!push || item.completedOn || !canPush(item.appId)) return undefined;
  return () => push(item);
}

/** A small Push icon for list rows with no menu of their own (the Today feed, the Agenda card); nothing when Push is not offered. */
export function PushButton({ item, className }: { item: Pushable; className?: string }) {
  const push = usePush(item);
  if (!push) return null;
  return (
    <Tip label="Push — find it time">
      <Button size="icon-xs" variant="ghost" className={cn("text-muted-foreground shrink-0", className)} aria-label={`Push ${item.title}`} onClick={push}>
        <CalendarClock className="size-3.5" />
      </Button>
    </Tip>
  );
}
