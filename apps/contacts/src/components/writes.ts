import { toast } from "@lifeline/ui";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * How every part of a Person is removed (an Occasion, an Address, a Contact
 * detail, a Tie): at once, with an Undo on the toast that puts back that one
 * part. A failed write, either way, says so in a toast.
 */
export async function removeWithUndo<R>(what: string, remove: () => Promise<R>, restore: (removed: R) => Promise<void>): Promise<void> {
  try {
    const removed = await remove();
    toast.success(`Removed ${what}`, {
      action: {
        label: "Undo",
        onClick: () => void restore(removed).catch((e) => toast.error(`${what} could not be put back.`, { description: message(e) })),
      },
    });
  } catch (e) {
    toast.error(`${what} could not be removed.`, { description: message(e) });
  }
}

/** Run a write from a click, saying so in a toast when it fails. */
export function writeOrSay(failure: string, write: () => Promise<unknown>): void {
  write().catch((e) => toast.error(failure, { description: message(e) }));
}
