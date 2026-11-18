import { closePeek, type PeekProps } from "@lifeline/core";
import { Button, toast, toastWithUndo } from "@lifeline/ui";
import { Trash2 } from "lucide-react";
import type { Exchange } from "../domain/types";
import { removeExchange, restoreExchange } from "../data/exchanges";
import { ExchangeForm } from "./ExchangeForm";
import { message } from "./writes";

/**
 * The Contacts App's part of an Exchange's Peek (ADR 0085, ADR 0131): its Form,
 * editing — With, Kind and Day, written as they change; the derived title, the
 * body and the ways through are the frame's. Delete acts at once, with Undo.
 */
export function ExchangePeek({ doc }: PeekProps) {
  const remove = async () => {
    const gone = await removeExchange(doc.id);
    closePeek();
    toastWithUndo(`${gone.title} deleted`, () => restoreExchange(gone));
  };
  return (
    <div className="grid min-w-0 gap-4">
      <ExchangeForm mode="editing" exchange={doc as Exchange} />
      <Button variant="destructive" size="sm" className="justify-self-start" onClick={() => void remove().catch((e: unknown) => toast.error("The exchange could not be deleted.", { description: message(e) }))}>
        <Trash2 /> Delete exchange
      </Button>
    </div>
  );
}
