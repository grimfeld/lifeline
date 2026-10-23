import { useState } from "react";
import { CommitField, Field, TagInput } from "@lifeline/ui";
import { effectiveTags, extractProseTags, normalizeTag, patchDocument, useTagVocabulary, type Document } from "@lifeline/core";

/**
 * Known Fields an App's editable Peek part may show for its own types (ADR
 * 0085), each written straight to the Document: they are not a form over
 * Fields, and the App picks which fit. Its own Fields it draws with
 * `CommitField` and `ChoiceField` from the kit.
 */

/** Other names the Document is linked by (CONTEXT.md "Alias"), written comma-separated. */
export function AliasesField({ doc }: { doc: Document }) {
  const aliases = Array.isArray(doc.aliases) ? (doc.aliases as string[]) : [];
  const parse = (t: string) =>
    t
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  return (
    <CommitField
      label="Aliases"
      value={aliases.join(", ")}
      placeholder="Other names, comma-separated"
      delay={500}
      onCommit={(text) => {
        const next = parse(text);
        return JSON.stringify(next) !== JSON.stringify(aliases) ? patchDocument(doc.id, { aliases: next }) : undefined;
      }}
    />
  );
}

/** The Document's Tags: the ones given by hand edited, the ones written in its text shown beside. */
export function TagsField({ doc }: { doc: Document }) {
  const [error, setError] = useState("");
  const body = typeof doc.body === "string" ? doc.body : "";
  const proseTags = extractProseTags(body);
  const explicit = (Array.isArray(doc.tags) ? doc.tags : []).filter((t) => !proseTags.includes(t));
  const suggestions = useTagVocabulary().map((v) => v.tag);
  const save = (next: string[]) =>
    patchDocument(doc.id, { tags: effectiveTags(next, body) }).then(
      () => setError(""),
      (err: unknown) => setError(err instanceof Error ? err.message : String(err)),
    );
  return (
    <Field label="Tags" hint={proseTags.length > 0 ? `in text: ${proseTags.map((t) => `#${t}`).join(" ")}` : undefined} error={error}>
      <TagInput value={explicit} onChange={(next) => void save(next)} suggestions={suggestions} normalize={normalizeTag} placeholder="Add tag…" />
    </Field>
  );
}
