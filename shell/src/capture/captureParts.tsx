import { useRef } from "react";
import { cn, toast } from "@lifeline/ui";
import {
  CAPTURE_PINS_MAX,
  commandKey,
  foldLabelOf,
  saveCapturePins,
  togglePin,
  useCaptureSheet,
  useCurrentWorkspace,
  type CaptureCommand,
  type CaptureEntry,
} from "@lifeline/core";
import { FolderOpen, Pin, Terminal } from "lucide-react";

/**
 * Pieces the capture sheet (phone) and the palette (desk) share: what an
 * entry looks like, how a pin is toggled, and a fold's picker.
 */

const LONG_PRESS_MS = 500;

/**
 * Press-and-hold for a secondary action, tap for the primary one. A hold that
 * fired swallows the click that follows it, and moving the finger (a scroll)
 * cancels the hold.
 */
export function useLongPress(onLongPress: () => void, onTap: () => void) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  return {
    onPointerDown: () => {
      fired.current = false;
      clear();
      timer.current = window.setTimeout(() => {
        fired.current = true;
        onLongPress();
      }, LONG_PRESS_MS);
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onPointerMove: (e: React.PointerEvent) => {
      if (Math.abs(e.movementX) + Math.abs(e.movementY) > 4) clear();
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onClick: () => {
      if (fired.current) {
        fired.current = false;
        return;
      }
      onTap();
    },
  };
}

/** Pin or unpin an entry on the current Workspace, saying what happened. */
export function useTogglePin() {
  const ws = useCurrentWorkspace();
  const { pins, pinnable } = useCaptureSheet();
  return async (entry: CaptureEntry) => {
    if (!ws) return;
    const next = togglePin(pins, entry.key, new Set(pinnable.map((e) => e.key)));
    if (!next) {
      toast.error(`Pins are full (${CAPTURE_PINS_MAX}) — unpin one first`);
      return;
    }
    await saveCapturePins(ws, next);
    toast.success(next.includes(entry.key) ? `Pinned “${entry.title}”` : `Unpinned “${entry.title}”`);
  };
}

export function entryIcon(entry: CaptureEntry): React.ComponentType<{ className?: string }> {
  if (entry.kind === "fold") return FolderOpen;
  return entry.command.icon ?? Terminal;
}

/** One cell of the sheet's two-column grid. Tap runs it, hold pins or unpins it. */
export function CaptureCell({
  entry,
  label,
  pinned,
  onPick,
  onTogglePin,
}: {
  entry: CaptureEntry;
  /** Inside a fold the members go by their fold label. */
  label?: string;
  pinned: boolean;
  onPick: () => void;
  onTogglePin: () => void;
}) {
  const press = useLongPress(onTogglePin, onPick);
  const Icon = entryIcon(entry);
  return (
    <button
      {...press}
      className="border-input hover:bg-accent relative flex touch-manipulation items-center gap-3 rounded-lg border p-3 text-left text-sm select-none"
    >
      <Icon className="size-5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label ?? entry.title}</span>
      {pinned && <Pin className="text-muted-foreground size-3 shrink-0" aria-label="Pinned" />}
    </button>
  );
}

/** A fold's members as entries, labelled as the fold's picker labels them. */
export function foldMembers(entry: Extract<CaptureEntry, { kind: "fold" }>): { entry: CaptureEntry; label: string }[] {
  return entry.members.map((c: CaptureCommand) => ({
    entry: { kind: "command", key: commandKey(c), title: c.title, command: c },
    label: foldLabelOf(c),
  }));
}

export function SectionHeading({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn("text-muted-foreground col-span-2 px-1 pt-2 text-xs font-medium tracking-wide uppercase", className)}>{children}</h3>;
}
