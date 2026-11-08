import { useState } from "react";
import { Button, Tip, toast } from "@lifeline/ui";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { editAddress, isUnplaced, sortedAddresses } from "../domain/addresses";
import { removePart, restorePart, updateAddresses } from "../data/repo";
import { relocateAddress } from "../data/addresses";
import { removeWithUndo, writeOrSay } from "./writes";
import type { Address, Person } from "../domain/types";
import { Section } from "./Section";
import { AddressDialog } from "./AddressDialog";

function AddressRow({ person, address, onEdit }: { person: Person; address: Address; onEdit: () => void }) {
  const change = (write: () => Promise<unknown>) => writeOrSay("The Address could not be changed.", write);

  // The retry: an explicit click, so the lookup may run (Core's geocode is never called on render).
  const retry = () =>
    change(async () => {
      if (!(await relocateAddress(person.id, address))) toast.error("Still no place found for this Address. Check its text, or try again later.");
    });

  return (
    <li className="grid min-w-0 gap-1 rounded-lg border p-2" data-testid="address" data-former={address.former || undefined}>
      <div className="flex min-w-0 items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="min-w-0 text-sm font-medium break-words">
            {address.label}
            {address.former && <span className="text-muted-foreground font-normal"> · former</span>}
          </p>
          <p className="text-muted-foreground min-w-0 text-sm break-words whitespace-pre-line">{address.text}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Tip label={`Change ${address.label}`}>
            <Button variant="ghost" size="icon" onClick={onEdit}>
              <Pencil />
            </Button>
          </Tip>
          <Tip label={`Remove ${address.label}`}>
            <Button variant="ghost" size="icon" onClick={() => void removeWithUndo(address.label, () => removePart(person.id, "addresses", address.id), (r) => restorePart(person.id, "addresses", r))}>
              <Trash2 />
            </Button>
          </Tip>
        </div>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {isUnplaced(address) && (
          <>
            <span className="text-muted-foreground text-xs">Not on the map: no place found.</span>
            <Button variant="outline" size="sm" onClick={retry}>
              <MapPin /> Try again
            </Button>
          </>
        )}
        <Button variant="ghost" size="sm" onClick={() => change(() => updateAddresses(person.id, (list) => editAddress(list, address.id, { former: !address.former })))}>
          {address.former ? "Mark as current" : "Mark as former"}
        </Button>
      </div>
    </li>
  );
}

/** The Person page's Addresses (#418): current ones first, former ones kept below as history. */
export function AddressesSection({ person }: { person: Person }) {
  const [editing, setEditing] = useState<Address | "new" | null>(null);
  const list = sortedAddresses(person.addresses ?? []);
  return (
    <Section title="Addresses">
      {list.length === 0 && <p className="text-muted-foreground text-sm">No address yet.</p>}
      {list.length > 0 && (
        <ul className="grid min-w-0 gap-2">
          {list.map((a) => (
            <AddressRow key={a.id} person={person} address={a} onEdit={() => setEditing(a)} />
          ))}
        </ul>
      )}
      <div>
        <Button variant="outline" size="sm" onClick={() => setEditing("new")}>
          <Plus /> Add address
        </Button>
      </div>
      <AddressDialog
        personId={person.id}
        address={editing && editing !== "new" ? editing : undefined}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
      />
    </Section>
  );
}
