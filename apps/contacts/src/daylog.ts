import { PERSON_TYPE, useDocuments, type DateStr, type DaylogItem, type DaylogProvider, type Document } from "@lifeline/core";
import { useMemo } from "react";
import { exchangeKindOf, type ExchangeKind } from "./domain/exchanges";
import { withOf, useExchanges } from "./data/exchanges";
import { personHref } from "./constants";

const APP_ID = "contacts";

/** The line's words by kind (ADR 0131): "Called Grandma", "Video call with Grandma", "Messaged Grandma", "Letter · Grandma". */
const WORDING: Record<ExchangeKind, { kind: string; lead: string }> = {
  call: { kind: "Called", lead: "" },
  video: { kind: "Video call with", lead: "" },
  message: { kind: "Messaged", lead: "" },
  letter: { kind: "Letter", lead: "· " },
};

/** The Exchanges of a day as Daylog lines, one each, their People joined; `nameOf` gives a Person's name (none once they are gone). */
export function exchangesOn(exchanges: readonly Document[], date: DateStr, nameOf: (id: string) => string | undefined): DaylogItem[] {
  return exchanges
    .filter((x) => x.date === date)
    .map((x) => {
      const ids = withOf(x);
      const names = ids.flatMap((id) => nameOf(id) ?? []);
      const { kind, lead } = WORDING[exchangeKindOf(x.kind)];
      return {
        key: `${APP_ID}/exchange/${x.id}`,
        appId: APP_ID,
        itemId: x.id,
        kind,
        title: `${lead}${names.length ? names.join(", ") : "nobody"}`,
        time: null,
        ...(ids[0] && nameOf(ids[0]) ? { href: personHref(ids[0]) } : {}),
        tags: x.tags ?? [],
      };
    });
}

/** What happened in People on a day: the Exchanges logged on it, a line each (ADR 0131). An Exchange stands on no time Surface; this is its one place in the day. */
export const contactsDaylog: DaylogProvider = {
  appId: APP_ID,
  useItems(date) {
    const exchanges = useExchanges();
    const people = useDocuments(PERSON_TYPE);
    return useMemo(() => {
      const names = new Map(people.map((p) => [p.id, p.title]));
      return exchangesOn(exchanges, date, (id) => names.get(id));
    }, [exchanges, people, date]);
  },
};
