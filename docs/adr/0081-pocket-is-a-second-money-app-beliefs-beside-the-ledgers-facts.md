---
formerly: 0037
---

# Pocket is a second money App: beliefs beside the Ledger's facts

The Ledger App is kept exact by feeding it nothing but bank exports (ADR 0033), which means its Budget lens can only say how a month went once the statement is in — never how the month is *going*. The gap is a running tally kept by hand between statements: "Eating out, €300 this month, €40 tonight, €115 left." The decision is that this tally is a **separate App, Pocket**, with its own two Document types — an **Allowance** (a named sum granted for one period: a Monday-first week, a calendar month, a calendar year, or a custom span of days) and a **Spend** (an internal Document: a hand-typed amount taken from an Allowance on a day, with an optional label) — and **no reference to the Ledger at all**. Pocket holds what the user believes they have left; the Ledger holds what the bank says happened. Nothing in Pocket is ever a Transaction, nothing in Pocket reads a Category, and the two are compared by eye after import. What is left derives at read (granted minus Spends, negative allowed, nothing clamps), a new period means new Allowances (renewal is a one-tap clone with no Spends, never automatic — the Dues precedent; a custom span never renews), and nothing rolls over — sinking funds remain the Ledger's accumulating Category.

## Considered options

- **"Planned" Transactions inside the Ledger** — rejected: the ledger would hold guesses beside facts, every derivation would need to know which is which, and every import would have to match each guess against the bank row it became — the exact drift ADR 0033 refused by rejecting envelopes.
- **An estimate overlay on the Budget screen** (a per-month list of hand-typed amounts hanging off each Category) — rejected: it welds the rough tally to the Category tree. A "Vacation" or "Christmas gifts" Allowance has no Category, a weekly Allowance has no month, and the Budget screen would carry two truths in one column.
- **A standing Allowance definition with monthly instances** (Target + Allocation override, again) — rejected: it duplicates the Ledger's policy machinery for a tracker that is thrown away when the statement arrives. One Document per period, cloned on renew, keeps history readable with one type.
- **Rollover of what is left** — rejected: envelopes by the back door, and the Ledger already owns the sinking-fund pot.
- **An optional Category link so Pocket can show "the Ledger says €X"** — deferred, not rejected: Apps interoperate only through Core Contracts, and no Contract for cross-App money reads exists; inventing one for a comparison number is premature until by-eye comparison is shown to hurt.

## Consequences

- Types: `pocket_allowance` (Linkable, Taggable, bodiless, derived title "Eating out · September 2026" / "· W36 2026" / "· 2026" / "· 12–20 Sept 2026") and internal `pocket_spend` (bodiless, `allowance` link, cents, day, label). Amounts are integer cents in the app-wide currency, as the Ledger's are.
- Derived, never stored: left per Allowance; the current / upcoming / past buckets from the period against today; the period's end day for week, month and year (only a custom span stores its end).
- Lifecycle: deleting an Allowance deletes its Spends (Life Level's cascade precedent); the granted amount is editable in place with no history of the change; a Spend's day is unconstrained by its Allowance's period — the Allowance was picked explicitly and that is the binding.
- Contracts: Daylog on Spend ("€12 · Eating out · lunch"); deliberately no Schedulable or Timed — a period is not an Event.
- Surfaces: one App screen (current / upcoming / past, renew per Allowance and "renew all ended"), one "Allowances" Card fit for the phone home, one capture Command "Spend…" for the phone's capture sheet; generic Bases come free.
- If Pocket is ever folded into the Ledger, this ADR and ADR 0033's envelope rejection are the two to reopen together.
