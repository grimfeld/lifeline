import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, toast } from "@lifeline/ui";
import { roleDef, type Document } from "@lifeline/core";
import { turnIntoPerson } from "../turnIntoPerson";

/**
 * "Turn into a Person" (CONTEXT.md "Person", ADR 0113), asked before it is
 * done: an Author or Artist the user has come to know becomes a Person that
 * still wears the Role. Nothing is lost; People then lists it.
 */
export function TurnIntoPersonDialog({ doc, roleId, onClose, onDone }: { doc: Document | null; roleId: string; onClose: () => void; onDone?: (person: Document) => void }) {
  const [busy, setBusy] = useState(false);
  const role = roleDef(roleId)?.label ?? "Author";
  async function run() {
    if (!doc) return;
    setBusy(true);
    try {
      const person = await turnIntoPerson(doc.id, roleId);
      toast.success(`${doc.title} is now a Person`);
      onDone?.(person);
    } catch (e) {
      toast.error((e as Error).message || "Could not turn into a Person");
    } finally {
      setBusy(false);
      onClose();
    }
  }
  return (
    <AlertDialog open={!!doc} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="break-words">Turn {doc?.title} into a Person?</AlertDialogTitle>
          <AlertDialogDescription>
            They become one of your People, and stay an {role}: their works still link to them. Their links, aliases and notes carry over unchanged.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={busy} onClick={() => void run()}>
            Turn into a Person
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
