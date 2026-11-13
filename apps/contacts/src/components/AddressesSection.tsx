import { useState } from "react";
import { Button, cn, toast } from "@lifeline/ui";
import { MapPin } from "lucide-react";
import { editAddress, isUnplaced, sortedAddresses } from "../domain/addresses";
import { removePart, restorePart, updateAddresses } from "../data/repo";
import { relocateAddress } from "../data/addresses";
import { removeWithUndo, writeOrSay } from "./writes";
import type { Address, Person } from "../domain/types";
import { Section } from "./Section";
import { AddressDialog } from "./AddressDialog";
import { AddRow, CardList, CardRow } from "./Cards";

function AddressRow({ person, address, onEdit }: { person: Person; address: Address; onEdit: () => void }) {
  const change = (write: () => Promise<unknown>) => writeOrSay("The Address could not be changed.", write);

  // The retry: an explicit click, so the lookup may run (Core's geocode is never called on render).
  const retry = () =>
    change(async () => {
      const placed = await relocateAddress(person.id, address);
      if (placed === "none") toast.error("Still no place found for this Address. Check its text.");
      if (placed === "failed") toast.error("The map lookup could not be reached. Try again later.");
    });

  return (
    <CardRow
      icon={<MapPin className={cn("size-4", !isUnplaced(address) && !address.former && "text-primary")} />}
      title={<span className={cn("whitespace-pre-line", address.former && "line-through")}>{address.text}</span>}
      sub={
        <>
          {address.label}
          {address.former && " · former"}
          {isUnplaced(address) && " · not on the map: no place found"}
        </>
      }
      editLabel={`Change ${address.label}`}
      onEdit={onEdit}
      removeLabel={`Remove ${address.label}`}
      onRemove={() => void removeWithUndo(address.label, () => removePart(person.id, "addresses", address.id), (r) => restorePart(person.id, "addresses", r))}
      former={address.former}
      formerLabel={address.former ? `Mark ${address.label} current` : `Mark ${address.label} former`}
      onFormer={() => change(() => updateAddresses(person.id, (list) => editAddress(list, address.id, { former: !address.former })))}
      extra={
        isUnplaced(address) ? (
          <Button variant="ghost" size="xs" onClick={retry}>
            Try again
          </Button>
        ) : undefined
      }
      testId="address"
    />
  );
}

/** The Person page's Addresses (#418): current ones first, former ones kept below as history. A card (#422). */
export function AddressesSection({ person }: { person: Person }) {
  const [editing, setEditing] = useState<Address | "new" | null>(null);
  const list = sortedAddresses(person.addresses ?? []);
  return (
    <Section title="Addresses">
      <CardList>
        {list.length === 0 && <li className="text-muted-foreground px-3 py-2 text-sm">No address yet.</li>}
        {list.map((a) => (
          <AddressRow key={a.id} person={person} address={a} onEdit={() => setEditing(a)} />
        ))}
        <AddRow onClick={() => setEditing("new")}>Add address</AddRow>
      </CardList>
      <AddressDialog
        personId={person.id}
        address={editing && editing !== "new" ? editing : undefined}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
      />
    </Section>
  );
}
