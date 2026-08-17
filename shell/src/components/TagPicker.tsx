import { TagInput } from "@lifeline/ui";
import { normalizeTag, useTagVocabulary } from "@lifeline/core";

/** TagInput fed with the derived cross-App vocabulary (Taggable Contract, ADR 0014). */
export function TagPicker({
  id,
  value,
  onChange,
  placeholder,
  className,
  autoFocus,
}: {
  id?: string;
  value: readonly string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const vocab = useTagVocabulary();
  return (
    <TagInput
      id={id}
      value={value}
      onChange={onChange}
      suggestions={vocab.map((v) => v.tag)}
      normalize={normalizeTag}
      placeholder={placeholder}
      className={className}
      autoFocus={autoFocus}
    />
  );
}
