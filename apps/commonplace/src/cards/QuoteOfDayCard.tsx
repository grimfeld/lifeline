import type { CardProps } from "@lifeline/core";
import { pickForDay, todayStr } from "@lifeline/core";
import { BigQuote } from "../components/BigQuote";
import { useQuotePool } from "./quoteShared";

/** Card: the same quote all day, another tomorrow. */
export function QuoteOfDayCard({ settings }: CardProps) {
  const { pool, byId } = useQuotePool(settings);
  const pick = pickForDay(pool, todayStr());
  if (!pick) return <div className="text-muted-foreground flex h-full items-center justify-center text-sm">No quotes yet.</div>;
  return <BigQuote quote={pick} item={byId.get(pick.source)} />;
}
