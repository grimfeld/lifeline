import { useMemo, useState, type AriaAttributes } from "react";
import { PERSON_TYPE, PLACE_TYPE, atTarget, getDocument, useDocumentTypes, useDocuments, useLiveQuery } from "@lifeline/core";
import { Button, Combobox, toast } from "@lifeline/ui";
import { MapPin, X } from "lucide-react";
import { atOptions, typeLine } from "./atChoice";

/**
 * An Event's At (ADR 0119): one Place, or one Person meaning their home.
 * A type-ahead that completes both by name or alias and says which each is;
 * a name that matches none can make a Place there, through the Place type's
 * own `createNamed`, so the App using it imports neither Atlas nor Contacts.
 * Writes one id, "" when cleared.
 */
export function AtField({
  value,
  onChange,
  id,
  placeholder = "A place, or a person's home…",
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: {
  value: string;
  onChange: (id: string) => void;
  id?: string;
  placeholder?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: AriaAttributes["aria-invalid"];
}) {
  const places = useDocuments(PLACE_TYPE);
  const people = useDocuments(PERSON_TYPE);
  const types = useDocumentTypes();
  const defOf = useMemo(() => (type: string) => types.find((t) => t.id === type), [types]);
  const [query, setQuery] = useState("");
  const options = useMemo(() => atOptions([...places, ...people], value, defOf), [places, people, value, defOf]);
  // undefined while it loads, null once it is known to be gone: a purged At must not read "…" forever.
  const chosen = useLiveQuery(async () => (value ? ((await getDocument(value)) ?? null) : null), [value], undefined);
  const target = chosen ? atTarget(chosen, value) : undefined;
  const loading = chosen === undefined || (chosen !== null && chosen.id !== value);
  const createPlace = defOf(PLACE_TYPE)?.createNamed;

  return (
    <div className="grid min-w-0 gap-1">
      {value && (
        <div className="flex min-w-0">
          <span className="bg-muted inline-flex max-w-full min-w-0 items-center gap-1 rounded-md pl-1.5 text-xs">
            <MapPin className="text-muted-foreground size-3 shrink-0" />
            <span className="min-w-0 truncate">{target ? target.title : loading ? "…" : "No longer here"}</span>
            {target && chosen && <span className="text-muted-foreground shrink-0">{typeLine(chosen, defOf(chosen.type))}</span>}
            <Button size="icon-xs" variant="ghost" className="text-muted-foreground" aria-label="Clear At" onClick={() => onChange("")}>
              <X />
            </Button>
          </span>
        </div>
      )}
      <Combobox
        id={id}
        query={query}
        onQueryChange={setQuery}
        options={options}
        onValueChange={(v) => onChange(v)}
        onCreate={
          createPlace
            ? (name) => {
                createPlace(name).then(
                  (doc) => onChange(doc.id),
                  (e: Error) => toast.error(`Couldn’t add the place: ${e.message}`),
                );
              }
            : undefined
        }
        createLabel={(q) => <>New place “{q}”</>}
        limit={6}
        listLabel="Places and people"
        leading={<MapPin />}
        placeholder={placeholder}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
      />
    </div>
  );
}
