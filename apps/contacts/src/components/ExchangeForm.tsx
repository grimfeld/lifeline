import { useState } from "react";
import { todayStr } from "@lifeline/core";
import { PeopleField } from "@lifeline/editor";
import { ChoiceField, DatePicker, Field, Textarea } from "@lifeline/ui";
import type { Exchange } from "../domain/types";
import { EXCHANGE_KINDS, exchangeKindOf, exchangeProblem, FUTURE_EXCHANGE, type ExchangeKind } from "../domain/exchanges";
import { editExchange, withOf } from "../data/exchanges";
import { message } from "./writes";

/** An Exchange being added: nothing is written until it is saved. */
export interface ExchangeDraft {
  with: string[];
  kind: ExchangeKind;
  date: string;
  body: string;
}

/** A new draft: with whoever it is opened with, a call, today. */
export const blankExchange = (withIds: readonly string[] = []): ExchangeDraft => ({ with: [...withIds], kind: "call", date: todayStr(), body: "" });

/** What the Form says under a field of a draft: only a day to come is said; nobody in With disables Save instead. */
export const draftDayError = (d: Pick<ExchangeDraft, "date">) => (d.date > todayStr() ? FUTURE_EXCHANGE : undefined);

/** Whether a draft may be saved as it stands. */
export const draftReady = (d: ExchangeDraft) => !exchangeProblem(d, todayStr());

/**
 * The Contacts App's one **Form** for an Exchange (ADR 0124, ADR 0131): the Log
 * an exchange dialog and the Exchange's Peek draw the same Fields through it.
 *
 * - **adding** — a draft the dialog holds and saves, body included.
 * - **editing** — an Exchange, written as it changes through `editExchange`;
 *   what it refuses (a day to come, nobody left in With) shows under the
 *   field. Its body is the Peek's, as any Document's, so the Form hides it.
 */
export type ExchangeFormProps = { mode: "adding"; draft: ExchangeDraft; onChange: (draft: ExchangeDraft) => void } | { mode: "editing"; exchange: Exchange };

export function ExchangeForm(props: ExchangeFormProps) {
  if (props.mode === "adding") {
    const { draft, onChange } = props;
    return <ExchangeFields body value={draft} dayError={draftDayError(draft)} onChange={(patch) => onChange({ ...draft, ...patch })} />;
  }
  return <EditingForm key={props.exchange.id} exchange={props.exchange} />;
}

function EditingForm({ exchange }: { exchange: Exchange }) {
  const [errors, setErrors] = useState<{ with?: string; date?: string }>({});
  const value = { with: withOf(exchange), kind: exchangeKindOf(exchange.kind), date: String(exchange.date ?? ""), body: "" };
  const write = (key: "with" | "date" | "kind", patch: Partial<ExchangeDraft>) =>
    editExchange(exchange.id, patch).then(
      () => setErrors((e) => ({ ...e, [key]: undefined })),
      (e: unknown) => setErrors((was) => ({ ...was, [key]: message(e) })),
    );
  return (
    <ExchangeFields
      value={value}
      withError={errors.with}
      dayError={errors.date}
      onChange={(patch) => {
        if (patch.with) void write("with", { with: patch.with });
        if (patch.date !== undefined) void write("date", { date: patch.date });
        if (patch.kind) void write("kind", { kind: patch.kind });
      }}
    />
  );
}

/** The one set of controls, in the order both modes show them; the body only while adding. */
function ExchangeFields({
  value,
  onChange,
  withError,
  dayError,
  body = false,
}: {
  value: ExchangeDraft;
  onChange: (patch: Partial<ExchangeDraft>) => void;
  withError?: string;
  dayError?: string;
  body?: boolean;
}) {
  return (
    <div role="group" aria-label="Exchange" className="grid min-w-0 gap-4">
      <Field label="With" error={withError}>
        <PeopleField label="With" value={value.with} onChange={(ids) => onChange({ with: ids })} households />
      </Field>
      <ChoiceField label="Kind" value={value.kind} options={EXCHANGE_KINDS} onCommit={(kind) => onChange({ kind: exchangeKindOf(kind) })} />
      <Field label="Day" error={dayError}>
        <DatePicker value={value.date} onChange={(date) => onChange({ date })} required startYear={1900} aria-label="Day" />
      </Field>
      {body && (
        <Field label="What was said">
          {/* Grows with what is typed, up to a point, then scrolls inside itself. */}
          <Textarea value={value.body} onChange={(e) => onChange({ body: e.target.value })} rows={4} className="max-h-72 overflow-y-auto" placeholder="Optional: what they told you, to have it next time" />
        </Field>
      )}
    </div>
  );
}
