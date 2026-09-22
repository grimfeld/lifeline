import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@lifeline/ui";
import { useAisles } from "../data/repo";

/** Radix forbids "" as an item value; Anywhere is stored as "". */
const ANYWHERE = "__anywhere";

/** Pick an Aisle, or none — buyable anywhere. */
export function AisleSelect({ value, onChange, className }: { value: string; onChange: (aisleId: string) => void; className?: string }) {
  const aisles = useAisles();
  const known = aisles.some((a) => a.id === value);
  return (
    <Select value={known ? value : ANYWHERE} onValueChange={(v) => onChange(v === ANYWHERE ? "" : v)}>
      <SelectTrigger className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANYWHERE}>Anywhere</SelectItem>
        {aisles.map((a) => (
          <SelectItem key={a.id} value={a.id}>
            {a.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
