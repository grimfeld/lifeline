import { useState, type ReactNode } from "react";
import { Combobox, type ComboboxOption } from "@lifeline/ui";
import { lookupRows, type LookupHit, type LookupRow } from "../lookup";

type Row<H extends LookupHit> = LookupRow<H> & ComboboxOption;

/**
 * The family Apps' QuickAdd input (ADR 0006 amendment, ADR 0079): type a title,
 * Enter adds the typed text; when the medium has a lookup its hits (cover,
 * title, byline · year) follow, reached with the arrows. The text survives
 * a change of medium, and the lookup follows it (`medium`).
 */
export function QuickPick<H extends LookupHit>({
  medium,
  search,
  byline,
  cover,
  onAdd,
  onPick,
  placeholder,
  "aria-label": ariaLabel,
  autoFocus,
  initialText = "",
  className,
}: {
  /** The medium searched; a change starts the lookup over. */
  medium: string;
  /** The medium's lookup, or none (no key, no provider): then only the typed text adds. */
  search: ((query: string, signal: AbortSignal) => Promise<readonly H[]>) | null;
  byline: (hit: H) => string | undefined;
  cover: (hit: H) => ReactNode;
  /** Enter on the typed text ("Title — Creator"). */
  onAdd: (text: string) => void;
  onPick: (hit: H) => void;
  placeholder?: string;
  "aria-label"?: string;
  autoFocus?: boolean;
  /** The input opens holding this. */
  initialText?: string;
  className?: string;
}) {
  const [text, setText] = useState(initialText);
  return (
    <Combobox<Row<H>>
      key={medium}
      query={text}
      onQueryChange={setText}
      search={search ? async (q, signal) => lookupRows(await search(q, signal), byline).map((r) => ({ ...r, icon: cover(r.hit) })) : undefined}
      searchDelay={400}
      onValueChange={(_, row) => onPick(row.hit)}
      onCreate={onAdd}
      createPosition="first"
      createLabel={(t) => <>Add “{t}”</>}
      listLabel="Lookup results"
      placeholder={placeholder}
      aria-label={ariaLabel}
      autoFocus={autoFocus}
      className={className}
    />
  );
}
