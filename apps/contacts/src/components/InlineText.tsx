import { Field, Input, cn, useCommitDraft } from "@lifeline/ui";

/**
 * A line of text written where it stands: on Enter or on leaving it; Escape puts it back.
 * A refused write shows under the field and leaves what was typed, to be fixed. The page
 * around it says what it is, so its label is for screen readers only. At rest a dashed
 * underline says it can be changed, on a touch screen too; hover and focus draw the box.
 */
export function InlineText({ label, value, placeholder, required, onCommit, className }: { label: string; value: string; placeholder?: string; required?: boolean; onCommit: (v: string) => unknown; className?: string }) {
  const { draft, error, change, commit, revert } = useCommitDraft(
    value,
    (next: string) => {
      const text = next.trim();
      if (required && !text) throw new Error(`${label} can't be empty.`);
      return onCommit(text);
    },
    { equals: (a, b) => a.trim() === b.trim() },
  );
  return (
    <Field label={label} hideLabel error={error} className="min-w-0 gap-1">
      <Input
        value={draft}
        placeholder={placeholder}
        onChange={(e) => change(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            e.stopPropagation();
            revert();
            e.currentTarget.blur();
          }
        }}
        className={cn("border-transparent border-b-input hover:border-input focus-visible:border-ring border-dashed bg-transparent dark:bg-transparent hover:border-solid focus-visible:border-solid", className)}
      />
    </Field>
  );
}
