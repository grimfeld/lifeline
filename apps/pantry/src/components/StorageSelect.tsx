import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@lifeline/ui";
import { useStorages } from "../data/repo";

/** Pick the Storage a Provision sits in — the dialog's and the Peek's. */
export function StorageSelect({ id, value, onChange }: { id?: string; value: string; onChange: (storageId: string) => void }) {
  const storages = useStorages();
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label="Storage" id={id} className="w-full min-w-0">
        <SelectValue placeholder="Pick a storage" />
      </SelectTrigger>
      <SelectContent>
        {storages.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
