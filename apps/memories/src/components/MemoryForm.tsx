import { Field, Input, DatePicker } from "@lifeline/ui";
import { todayStr } from "@lifeline/core";
import { LinksField } from "@lifeline/editor";

/** What the Memory's form edits: its title, the day it remembers, and what it is about (ids). */
export interface MemoryFormValue {
  title: string;
  date: string;
  about: string[];
}

/**
 * The Memory's Fields, drawn once for adding (the New memory dialog: title and
 * date, About left to its page) and for editing (its page: title, date and
 * About), as ADR 0124 asks. The owner holds the values and what a change does;
 * `onTitleBlur` is where an owner that saves as it goes writes the title.
 */
export function MemoryForm({
  value,
  onChange,
  onTitleBlur,
  titleError,
  showAbout = true,
  autoFocus,
}: {
  value: MemoryFormValue;
  onChange: (patch: Partial<MemoryFormValue>) => void;
  onTitleBlur?: () => void;
  titleError?: string;
  showAbout?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div className="grid min-w-0 gap-3">
      <Field label="Title" error={titleError}>
        <Input
          value={value.title}
          autoFocus={autoFocus}
          placeholder="Dancing on the terrace"
          onChange={(e) => onChange({ title: e.target.value })}
          onBlur={onTitleBlur}
          onKeyDown={(e) => {
            if (onTitleBlur && e.key === "Enter") e.currentTarget.blur();
          }}
        />
      </Field>
      <Field label="Date">
        <DatePicker value={value.date} required onChange={(d) => onChange({ date: d || todayStr() })} />
      </Field>
      {showAbout && (
        <Field label="About">
          <LinksField id="memory-about" value={value.about} onChange={(v) => onChange({ about: Array.isArray(v) ? v.map(String) : [] })} />
        </Field>
      )}
    </div>
  );
}
