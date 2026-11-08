import { useEffect, useState } from "react";
import { Badge, Button, ChoiceField, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Field, Input, Tip } from "@lifeline/ui";
import { AtSign, Mail, Pencil, Phone, Plus, Trash2, Undo2, UserX } from "lucide-react";
import { removePart, restorePart, updateContactDetails } from "../data/repo";
import { CONTACT_KINDS, KIND_LABELS, contactAction, contactDetailsOf, markFormer, saveDetail, validateDetail, type DetailInput } from "../domain/contactDetails";
import { message, removeWithUndo, writeOrSay } from "./writes";
import type { ContactDetail, ContactKind, Person } from "../domain/types";
import { Section } from "./Section";

const KIND_ICON = { phone: Phone, email: Mail, handle: AtSign } as const;
const PLACEHOLDER: Record<ContactKind, string> = { phone: "+33 6 12 34 56 78", email: "anne@example.org", handle: "@anne or instagram.com/anne" };
const BLANK: DetailInput = { label: "", kind: "phone", value: "" };

/** The Person page's Contact details (#404 story 69, CONTEXT.md "Contact detail"): each under its own label; a click calls, mails or opens the service; a former one is history, with no action. */
export function ContactDetailsSection({ person }: { person: Person }) {
  const details = contactDetailsOf(person);
  const [editing, setEditing] = useState<DetailInput | null>(null);
  const current = details.filter((c) => !c.former);
  const former = details.filter((c) => c.former);

  // Every change starts from the stored list, never from this render's copy: two quick ones keep each other.
  const update = (change: (list: ContactDetail[]) => ContactDetail[]) => updateContactDetails(person.id, change);

  const row = (c: ContactDetail) => (
    <DetailRow
      key={c.id}
      detail={c}
      onEdit={() => setEditing(c)}
      onFormer={() => writeOrSay(`${c.label} could not be changed.`, () => update((list) => markFormer(list, c.id, !c.former)))}
      onRemove={() => void removeWithUndo(c.label, () => removePart(person.id, "contactDetails", c.id), (r) => restorePart(person.id, "contactDetails", r))}
    />
  );

  return (
    <Section title="Contact details">
      {details.length === 0 && <p className="text-muted-foreground text-sm">No phone number, email or handle yet.</p>}
      {current.length > 0 && (
        <ul className="grid min-w-0 gap-2">
          {current.map(row)}
        </ul>
      )}
      {former.length > 0 && (
        <div className="grid min-w-0 gap-2">
          <h3 className="text-muted-foreground text-sm font-medium">Former</h3>
          <ul className="grid min-w-0 gap-2">
            {former.map(row)}
          </ul>
        </div>
      )}
      <div>
        <Button variant="outline" size="sm" onClick={() => setEditing(BLANK)}>
          <Plus /> Add contact detail
        </Button>
      </div>
      <DetailDialog
        input={editing}
        onClose={() => setEditing(null)}
        onSave={async (input) => {
          await update((list) => saveDetail(list, input));
          setEditing(null);
        }}
      />
    </Section>
  );
}

function DetailRow({ detail, onEdit, onFormer, onRemove }: { detail: ContactDetail; onEdit: () => void; onFormer: () => void; onRemove: () => void }) {
  const Icon = KIND_ICON[detail.kind];
  return (
    <li className="flex min-w-0 items-center gap-2 rounded-lg border p-2" data-former={detail.former || undefined}>
      <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden />
      <div className="grid min-w-0 flex-1 gap-0.5">
        <span className="text-muted-foreground text-xs">
          {detail.label}
          {detail.former && " · former"}
        </span>
        <DetailValue detail={detail} />
      </div>
      {detail.former && <Badge variant="outline" className="shrink-0">Former</Badge>}
      <div className="flex shrink-0 items-center">
        <Tip label={`Edit ${detail.label}`}>
          <Button variant="ghost" size="icon-xs" onClick={onEdit}>
            <Pencil />
          </Button>
        </Tip>
        <FormerButton detail={detail} onClick={onFormer} />
        <Tip label={`Remove ${detail.label}`}>
          <Button variant="ghost" size="icon-xs" onClick={onRemove}>
            <Trash2 />
          </Button>
        </Tip>
      </div>
    </li>
  );
}

/** The value: a link that calls, mails or opens the service when it can, else plain (struck through when former). */
function DetailValue({ detail }: { detail: ContactDetail }) {
  const action = contactAction(detail);
  if (!action) return <span className={detail.former ? "text-muted-foreground min-w-0 text-sm line-through" : "min-w-0 text-sm"}>{detail.value}</span>;
  return (
    <a href={action.href} {...(action.external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="min-w-0 text-sm underline-offset-2 hover:underline">
      {detail.value}
    </a>
  );
}

/** Mark a current detail former, or make a former one current again. */
function FormerButton({ detail, onClick }: { detail: ContactDetail; onClick: () => void }) {
  return (
    <Tip label={detail.former ? `Make ${detail.label} current` : `Mark ${detail.label} former`}>
      <Button variant="ghost" size="icon-xs" onClick={onClick}>
        {detail.former ? <Undo2 /> : <UserX />}
      </Button>
    </Tip>
  );
}

function DetailDialog({ input, onClose, onSave }: { input: DetailInput | null; onClose: () => void; onSave: (input: DetailInput) => Promise<void> }) {
  const [draft, setDraft] = useState<DetailInput>(BLANK);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (input) {
      setDraft(input);
      setError("");
    }
  }, [input]);

  async function submit() {
    const problem = validateDetail(draft);
    if (problem) return setError(problem);
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
          <Field label="Label">
            <Input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="Mobile, Work, Instagram…" autoComplete="off" autoFocus />
          </Field>
          <ChoiceField label="Kind" value={draft.kind} options={CONTACT_KINDS.map((k) => ({ value: k, label: KIND_LABELS[k] }))} onCommit={(kind) => setDraft({ ...draft, kind: kind as ContactKind })} />
          <Field label="Value" error={error || undefined}>
            <Input
              value={draft.value}
              onChange={(e) => {
                setDraft({ ...draft, value: e.target.value });
                setError("");
              }}
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
