import { ToggleGroup, ToggleGroupItem } from "@lifeline/ui";

/**
 * The Shelf switch of a media App (Library, Cinema, Discotheque, Arcade):
 * one choice per Shelf, each in the medium's verbs with its count. Segments
 * on the desk, a select on a phone — put it in a `PhoneDock` with `order={1}`
 * like any view switch (ADR 0064).
 */
export function ShelfControl<S extends string>({
  shelves,
  value,
  onChange,
  labelOf,
  counts,
}: {
  shelves: readonly S[];
  value: S;
  onChange: (shelf: S) => void;
  /** The Shelf in the medium's verbs ("Want to read", "In progress"…). */
  labelOf: (shelf: S) => string;
  counts: ReadonlyMap<S, number>;
}) {
  return (
    <ToggleGroup aria-label="Shelf" value={value} onValueChange={(v) => onChange(v as S)}>
      {shelves.map((s) => (
        <ToggleGroupItem key={s} value={s}>
          {labelOf(s)}
          <span className="tabular-nums opacity-60">{counts.get(s) ?? 0}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
