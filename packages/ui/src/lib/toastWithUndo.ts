import { toast } from "sonner";

/** A success toast with an Undo button; if the Undo itself fails, say so. The one place the "bring it back" message is written. */
export function toastWithUndo(message: string, undo: () => Promise<unknown> | unknown): void {
  toast.success(message, {
    action: {
      label: "Undo",
      onClick: () => void Promise.resolve().then(undo).catch((e: Error) => toast.error(`Could not bring it back: ${e.message}`)),
    },
  });
}
