import { useEffect, useState } from "react";
import { Badge, Button, ChoiceField, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Field, Input } from "@lifeline/ui";
import { AtSign, Mail, Phone } from "lucide-react";
import { removePart, restorePart, updateContactDetails } from "../data/repo";
import { CONTACT_KINDS, KIND_LABELS, contactAction, contactDetailsOf, detailLabelProblem, detailValueProblem, markFormer, saveDetail, type DetailInput } from "../domain/contactDetails";
import { message, removeWithUndo, writeOrSay } from "./writes";
import type { ContactDetail, ContactKind, Person } from "../domain/types";
import { Section } from "./Section";
import { AddRow, CardList, CardRow, useEditing } from "./Cards";

const KIND_ICON = { phone: Phone, email: Mail, handle: AtSign } as const;
const PLACEHOLDER: Record<ContactKind, string> = { phone: "+33 6 12 34 56 78", email: "anne@example.org", handle: "@anne or instagram.com/anne" };
export const BLANK_DETAIL: DetailInput = { label: "", kind: "phone", value: "" };
/** The keyboard a phone shows for each kind's value: digits for a number, the @ key for an email. A mode, not a type: the browser's own checks stay out of it. */
const INPUT_MODE: Record<ContactKind, "tel" | "email" | "text"> = { phone: "tel", email: "email", handle: "text" };

/**
 * The Person page's Contact details (#404 story 69, CONTEXT.md "Contact detail"): each under its own label; a click calls, mails or opens the service; a former one is history, with no action.
 * A card (#422): current ones first, former ones after them.
 */
export function ContactDetailsSection({ person, editing, onEditing }: { person: Person; editing: DetailInput | null; onEditing: (input: DetailInput | null) => void }) {
  const details = contactDetailsOf(person);
  // The page holds the dialog's state (what it edits: BLANK_DETAIL to add, null when shut), so its contact buttons can open it too.
  const ordered = [...details.filter((c) => !c.former), ...details.filter((c) => c.former)];

  // Every change starts from the stored list, never from this render's copy: two quick ones keep each other.
  const update = (change: (list: ContactDetail[]) => ContactDetail[]) => updateContactDetails(person.id, change);

  return (
    <Section title="Contact details">
      <CardList>
        {details.length === 0 && <li className="text-muted-foreground px-3 py-2 text-sm">No phone number, email or handle yet.</li>}
        {ordered.map((c) => {
          const Icon = KIND_ICON[c.kind];
          return (
            <CardRow
              key={c.id}
              icon={<Icon className="size-4" />}
              title={<DetailValue detail={c} />}
              sub={c.label}
              editLabel={`Edit ${c.label}: ${c.value}`}
              onEdit={() => onEditing(c)}
              removeLabel={`Remove ${c.label}`}
              onRemove={() => void removeWithUndo(c.label, () => removePart(person.id, "contactDetails", c.id), (r) => restorePart(person.id, "contactDetails", r))}
              former={c.former}
              formerLabel={c.former ? `Make ${c.label} current` : `Mark ${c.label} former`}
              onFormer={() => writeOrSay(`${c.label} could not be changed.`, () => update((list) => markFormer(list, c.id, !c.former)))}
              extra={c.former ? <Badge variant="outline">Former</Badge> : undefined}
            />
          );
        })}
        <AddRow onClick={() => onEditing(BLANK_DETAIL)}>Add contact detail</AddRow>
      </CardList>
      <DetailDialog
        input={editing}
        onClose={() => onEditing(null)}
        onSave={async (input) => {
          await update((list) => saveDetail(list, input));
          onEditing(null);
        }}
      />
    </Section>
  );
}

/** The value: a link that calls, mails or opens the service when it can, else plain (struck through when former). */
function DetailValue({ detail }: { detail: ContactDetail }) {
  // In Edit the row opens its dialog, so the value is no link of its own there.
  const action = useEditing() ? null : contactAction(detail);
  if (!action) return <span className={detail.former ? "line-through" : undefined}>{detail.value}</span>;
  return (
    <a href={action.href} {...(action.external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="underline-offset-2 hover:underline">
      {detail.value}
    </a>
  );
}

function DetailDialog({ input, onClose, onSave }: { input: DetailInput | null; onClose: () => void; onSave: (input: DetailInput) => Promise<void> }) {
  const [draft, setDraft] = useState<DetailInput>(BLANK_DETAIL);
  const [labelError, setLabelError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (input) {
      setDraft(input);
      setLabelError("");
      setError("");
    }
  }, [input]);

  async function submit() {
    // Each problem under the field it is about (CODING_STANDARDS.md § Forms and feedback).
    const labelProblem = detailLabelProblem(draft) ?? "";
    const valueProblem = detailValueProblem(draft) ?? "";
    setLabelError(labelProblem);
    setError(valueProblem);
    if (labelProblem || valueProblem) return;
    setBusy(true);
    try {
      await onSave(draft);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={input !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{input?.id ? "Edit contact detail" : "Add a contact detail"}</DialogTitle>
          <DialogDescription>A phone number calls, an email opens a new mail, a handle opens its service.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Field label="Label" error={labelError || undefined}>
            <Input
              value={draft.label}
              onChange={(e) => {
                setDraft({ ...draft, label: e.target.value });
                setLabelError("");
              }} placeholder="Mobile, Work, Instagram…" autoComplete="off" autoFocus />
          </Field>
          <ChoiceField label="Kind" value={draft.kind} options={CONTACT_KINDS.map((k) => ({ value: k, label: KIND_LABELS[k] }))} onCommit={(kind) => setDraft({ ...draft, kind: kind as ContactKind })} />
          <Field label="Value" error={error || undefined}>
            <Input
              value={draft.value}
              onChange={(e) => {
                setDraft({ ...draft, value: e.target.value });
                setError("");
              }}
              inputMode={INPUT_MODE[draft.kind]}
              placeholder={PLACEHOLDER[draft.kind]}
              autoComplete="off"
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
