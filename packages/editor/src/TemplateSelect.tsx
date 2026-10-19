import { useEffect, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@lifeline/ui";
import { defaultTemplateFor, templatesFor, useAllDocuments } from "@lifeline/core";

const BUILT_IN = "__builtin__";

/**
 * Which of a type's Templates a new Document starts from (CONTEXT.md
 * "Template"). Shown only when there is a choice — one Template, or none, is
 * simply used. `value` "" means the type's default.
 */
export function TemplateSelect({ type, value, onChange }: { type: string; value: string; onChange: (id: string) => void }) {
  const docs = useAllDocuments();
  const mine = useMemo(() => templatesFor(type, docs), [type, docs]);
  const def = useMemo(() => defaultTemplateFor(type, docs), [type, docs]);
  useEffect(() => {
    if (!value && def) onChange(def.id);
  }, [def, value, onChange]);
  if (mine.length < 2) return null;
  return (
    <Select value={value || def?.id || BUILT_IN} onValueChange={(v) => onChange(v === BUILT_IN ? "" : v)}>
      <SelectTrigger className="h-8 w-full" aria-label="Template">
        <SelectValue placeholder="Template" />
      </SelectTrigger>
      <SelectContent>
        {!def && <SelectItem value={BUILT_IN}>Built-in start</SelectItem>}
        {mine.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            {t.title}
            {def?.id === t.id ? " (default)" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
