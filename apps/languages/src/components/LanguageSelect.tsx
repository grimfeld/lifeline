import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@lifeline/ui";
import type { Language } from "../domain/types";

/** Pick one of the unarchived Languages. */
export function LanguageSelect({ languages, value, onChange, className }: { languages: Language[]; value: string; onChange: (id: string) => void; className?: string }) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className={className ?? "w-40"}>
        <SelectValue placeholder="Language" />
      </SelectTrigger>
      <SelectContent>
        {languages
          .filter((l) => !l.archived)
          .map((l) => (
            <SelectItem key={l.id} value={l.id}>
              {l.name}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}
