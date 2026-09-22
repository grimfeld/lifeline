import { Minus, Plus } from "lucide-react";
import { cn } from "@lifeline/ui";
import { todayStr } from "@lifeline/core";
import type { Provision } from "../domain/types";
import { DEFAULT_EXPIRY_WINDOW_DAYS, expiresSoon, isExpired, isRunningLow } from "../domain/rules";
import { adjustQuantity } from "../data/repo";
import { HandOffMenu } from "./HandOffMenu";

function Step({ label, icon: Icon, disabled, onClick }: { label: string; icon: typeof Plus; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className="hover:bg-accent flex size-6 shrink-0 items-center justify-center rounded-full border disabled:pointer-events-none disabled:opacity-30"
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon className="size-3" />
    </button>
  );
}

/** One Provision as a stepper row — the tap that keeps the counter honest. */
export function ProvisionRow({ p, onOpen, storageName }: { p: Provision; onOpen?: () => void; storageName?: string }) {
  const today = todayStr();
  const low = isRunningLow(p);
  const expired = isExpired(p, today);
  const soon = !expired && expiresSoon(p, today, DEFAULT_EXPIRY_WINDOW_DAYS);
  return (
    <li className="flex items-center gap-2 rounded-md px-1 py-0.5">
      <Step label="One fewer" icon={Minus} disabled={p.quantity <= 0} onClick={() => void adjustQuantity(p, -1)} />
      <span className={cn("w-7 shrink-0 text-center text-sm font-medium tabular-nums", p.quantity === 0 ? "text-destructive" : low ? "text-amber-600 dark:text-amber-500" : "")}>{p.quantity}</span>
      <Step label="One more" icon={Plus} onClick={() => void adjustQuantity(p, +1)} />
      <button type="button" className={cn("min-w-0 flex-1 truncate text-left text-sm", onOpen && "hover:underline")} onClick={onOpen}>
        {p.title}
      </button>
      {p.unit ? <span className="text-muted-foreground shrink-0 text-xs">{p.unit}</span> : null}
      {expired ? <span className="text-destructive shrink-0 text-xs">expired {p.expires}</span> : soon ? <span className="shrink-0 text-xs text-amber-600 dark:text-amber-500">by {p.expires}</span> : null}
      {storageName ? <span className="text-muted-foreground ml-auto shrink-0 text-xs">{storageName}</span> : null}
      {low ? <HandOffMenu handoff={() => ({ title: p.title, text: p.unit })} /> : null}
    </li>
  );
}
