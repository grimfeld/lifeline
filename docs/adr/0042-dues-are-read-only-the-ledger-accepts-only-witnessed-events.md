# Dues are read-only — the ledger accepts only witnessed events

ADR 0034 derived Recurring series from the ledger but kept one write: confirming a Due posted the expected Transaction ahead of the bank. That row was a prediction wearing a fact's clothes — indistinguishable from a real one, and the next import of the same payment sat beside it as a silent duplicate (import dedupe matches import ids, which a confirmed row never has). The invariant is now explicit: **nothing enters the ledger ahead of reality**. Every Transaction is a witnessed past event — a bank row imported, a purchase typed in after the fact, a reconcile gap — never an expectation. A Due is a *reading only*: it is watched until the bank statement brings the real Transaction (whose arrival makes it vanish, exactly as ADR 0034's projection already worked), or skipped by hand. Confirm is retired; skip and mute stay, and mute now means precisely "don't forecast me" — a muted series raises no Dues but still counts as fixed spending in reports. In exchange for purity the ledger accepts a small staleness: between a bill's due day and the next import, the balance lags reality — Pocket is the App for what the user believes they have in the meantime.

## Considered options

- **Keep confirm (status quo)** — rejected: it manufactures duplicates by design, and a hand-posted expectation is a second truth about a payment the bank will state authoritatively days later. The ledger's whole value is that it never argues with the statement.
- **Confirm marks the Due "expected" without posting** — rejected: state for state's sake. The bank row arrives and the Due vanishes anyway; an acknowledged-but-unposted flag changes nothing the user can see except a checkbox to maintain.
- **A one-off duplicate-cleanup sweep for historically confirmed rows** — rejected: confirmed rows carry no flag, so any sweep is a heuristic over payee/amount/date proximity with a human picking survivors. Old duplicates are deleted by hand as they are spotted; history is not rewritten wholesale.

## Consequences

- `confirmDue` is deleted. The Dues list keeps only Skip; the Dues Card and Recurring tab become pure forecast.
- The Money reports gain a fourth tab, **Recurring**: each month's spending split fixed against variable (fixed = rows belonging to a detected series, muted and dormant alike — dormancy is a forecast concept, history keeps its months), and a sortable per-series table (cadence, median, annual cost, last seen).
- Rows posted by confirm before this decision stay in the ledger untouched — they are indistinguishable by design (ADR 0034 rejected origin bookkeeping), and most describe payments that really happened.
