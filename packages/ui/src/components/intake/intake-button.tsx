import { useState, type ComponentType, type ReactNode } from "react";
import { ChevronDown, Send } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { cn } from "../../lib/utils";

/** One of Core's Intakes — structurally, so this package need not import it. */
export interface IntakeOption<H> {
  key: string;
  title: string;
  icon?: ComponentType<{ className?: string }>;
  dialog: ComponentType<{ open: boolean; onOpenChange: (open: boolean) => void; handoff: H }>;
}

/**
 * The sender's side of an Intake (ADR 0050) as a split button: the main part
 * opens the Intake last chosen from here ("+ Need"), the chevron lists them
 * all. Before any choice — or when the remembered one is gone — it is a plain
 * labelled menu. The sender names no receiver; the label is the user's.
 */
export function IntakeButton<H>({
  intakes,
  handoff,
  last,
  onChoose,
  label = "Hand off",
  className,
}: {
  intakes: IntakeOption<H>[];
  handoff: () => H;
  /** Key of the Intake last chosen from this sender, "" for none. */
  last: string;
  onChoose: (key: string) => void;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState<{ key: string; handoff: H } | null>(null);
  if (intakes.length === 0) return null;
  const remembered = intakes.find((i) => i.key === last);
  const chosen = open ? intakes.find((i) => i.key === open.key) : undefined;
  function choose(key: string) {
    onChoose(key);
    setOpen({ key, handoff: handoff() });
  }

  const part = "flex h-6 items-center gap-1 border border-current/40 text-xs hover:bg-current/10";
  const menu = (trigger: ReactNode) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {intakes.map((i) => (
          <DropdownMenuItem key={i.key} onSelect={() => choose(i.key)}>
            {i.icon && <i.icon className="size-4" />}
            {i.title}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      <span className={cn("flex shrink-0 items-center", className)}>
        {remembered ? (
          <>
            <button type="button" className={cn(part, "rounded-l-full border-r-0 pr-1.5 pl-2")} title={`${label} as ${remembered.title}`} onClick={() => choose(remembered.key)}>
              {remembered.icon ? <remembered.icon className="size-3" /> : <Send className="size-3" />}
              {remembered.title}
            </button>
            {menu(
              <button type="button" className={cn(part, "rounded-r-full px-1")} title={`${label} to…`}>
                <ChevronDown className="size-3" />
              </button>,
            )}
          </>
        ) : (
          menu(
            <button type="button" className={cn(part, "rounded-full px-2")} title={`${label} to…`}>
              <Send className="size-3" />
              {label}
              <ChevronDown className="size-3 opacity-60" />
            </button>,
          )
        )}
      </span>
      {chosen && open && <chosen.dialog open onOpenChange={(o) => !o && setOpen(null)} handoff={open.handoff} />}
    </>
  );
}
