import { useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  toast,
} from "@lifeline/ui";
import { countTypeDocuments, deleteDocumentType, deleteUserDocumentType, typeDeleteRefusal, type DocumentTypeRecord } from "@lifeline/core";

interface Removal {
  record: DocumentTypeRecord;
  /** A built-in type is reset to its default; a user-defined one is deleted. */
  builtIn: boolean;
}

/**
 * Deleting a Document type, or resetting a built-in one to its default — the Type editor's
 * and the Bases list's one flow. Neither has an Undo, so it asks first (ADR 0079); a type
 * with Documents is refused before asking, and again by the store if one arrived since
 * (ADR 0072). `ask` starts it; render `dialog`.
 */
export function useTypeRemoval({ onRefused, onRemoved }: { onRefused: (why: string) => void; onRemoved?: () => void }): {
  ask: (record: DocumentTypeRecord, builtIn: boolean) => Promise<void>;
  dialog: ReactNode;
} {
  const [removal, setRemoval] = useState<Removal | null>(null);
  const [open, setOpen] = useState(false);

  async function ask(record: DocumentTypeRecord, builtIn: boolean) {
    if (!builtIn) {
      const why = typeDeleteRefusal(record.label, await countTypeDocuments(record.typeId));
      if (why) return onRefused(why);
    }
    setRemoval({ record, builtIn });
    setOpen(true);
  }

  async function remove({ record, builtIn }: Removal) {
    if (builtIn) {
      await deleteDocumentType(record.id);
      toast.success(`“${record.label}” reset to its built-in default`);
      return onRemoved?.();
    }
    try {
      await deleteUserDocumentType(record);
    } catch (e) {
      return onRefused((e as Error).message);
    }
    toast.success(`Document type “${record.label}” deleted`);
    onRemoved?.();
  }

  const dialog = removal && (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {removal.builtIn ? `Reset “${removal.record.label}” to its default?` : `Delete the Document type “${removal.record.label}”?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {removal.builtIn
              ? "Your changes to it go — its name, icon, folder and the fields you added. What its Documents hold in those fields stays on them."
              : "It has no Documents. Its fields and its Base go with it."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => void remove(removal)}>{removal.builtIn ? "Reset to default" : "Delete type"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
  return { ask, dialog };
}
